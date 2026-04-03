import type { BadgeData, BadgeProps } from '../types';

export const DEFAULT_API_URL = 'https://api.uvrn.org';
export const DEFAULT_CACHE_MS = 60_000;

const badgeCache = new Map<string, BadgeData>();
const pendingLoads = new Map<string, Promise<BadgeData>>();

interface BadgeResponse {
  claimId?: string;
  status?: BadgeData['status'];
  vScore?: number;
}

type ThemeMode = NonNullable<BadgeProps['theme']>;
type ResolvedTheme = Exclude<ThemeMode, 'auto'>;
type ViewState = BadgeData['status'] | 'loading' | 'error';

export interface BadgePresentation {
  label: string;
  accentColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

function cacheKey(claimId: string): string {
  return claimId;
}

function isFresh(data: BadgeData, cacheMs: number): boolean {
  return Date.now() - data.cachedAt < cacheMs;
}

function isBadgeDataStatus(status: unknown): status is BadgeData['status'] {
  return status === 'STABLE' || status === 'DRIFTING' || status === 'CRITICAL';
}

function normalizeApiUrl(apiUrl?: string): string {
  const value = apiUrl?.trim() || DEFAULT_API_URL;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function paletteForStatus(state: ViewState): { icon: string; label: string; color: string } {
  switch (state) {
    case 'STABLE':
      return { icon: '🟢', label: 'STABLE', color: '#22c55e' };
    case 'DRIFTING':
      return { icon: '🟡', label: 'DRIFTING', color: '#f59e0b' };
    case 'CRITICAL':
      return { icon: '🔴', label: 'CRITICAL', color: '#ef4444' };
    case 'loading':
      return { icon: '⬜', label: 'Loading...', color: '#9ca3af' };
    default:
      return { icon: '⚪', label: 'Unavailable', color: '#9ca3af' };
  }
}

function buildReadyLabel(data: BadgeData, showStatus: boolean, showScore: boolean): string {
  const appearance = paletteForStatus(data.status);
  const parts = [appearance.icon];

  if (showStatus) {
    parts.push(appearance.label);
  }

  if (showScore) {
    parts.push(`V-Score: ${formatScore(data.vScore)}`);
  }

  if (!showStatus && !showScore) {
    parts.push(appearance.label);
  }

  return parts.join('  ');
}

export function clearBadgeCache(): void {
  badgeCache.clear();
  pendingLoads.clear();
}

export function getCachedBadgeData(claimId: string, cacheMs: number = DEFAULT_CACHE_MS): BadgeData | null {
  const cached = badgeCache.get(cacheKey(claimId));
  if (!cached || !isFresh(cached, cacheMs)) {
    return null;
  }

  return cached;
}

export async function loadBadgeData(
  claimId: string,
  apiUrl: string = DEFAULT_API_URL,
  cacheMs: number = DEFAULT_CACHE_MS
): Promise<BadgeData> {
  const key = cacheKey(claimId);
  const cached = getCachedBadgeData(claimId, cacheMs);
  if (cached) {
    return cached;
  }

  const pending = pendingLoads.get(key);
  if (pending) {
    return pending;
  }

  const request = (async (): Promise<BadgeData> => {
    const response = await fetch(`${normalizeApiUrl(apiUrl)}/claims/${claimId}/status`);
    if (!response.ok) {
      throw new Error(`Badge fetch failed with status ${response.status}`);
    }

    const payload = (await response.json()) as BadgeResponse;
    if (!isBadgeDataStatus(payload.status) || typeof payload.vScore !== 'number') {
      throw new Error('Badge response must include { status, vScore }');
    }

    const data: BadgeData = {
      claimId: payload.claimId ?? claimId,
      status: payload.status,
      vScore: payload.vScore,
      cachedAt: Date.now(),
    };

    badgeCache.set(key, data);
    return data;
  })();

  pendingLoads.set(key, request);

  try {
    return await request;
  } finally {
    pendingLoads.delete(key);
  }
}

export function resolveTheme(theme: ThemeMode = 'auto'): ResolvedTheme {
  if (theme === 'dark') {
    return 'dark';
  }

  if (
    theme === 'auto' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function getBadgePresentation(
  state: ViewState,
  theme: ResolvedTheme,
  options: {
    data?: BadgeData | null;
    showScore: boolean;
    showStatus: boolean;
  }
): BadgePresentation {
  const appearance = paletteForStatus(state);
  const label =
    state === 'STABLE' || state === 'DRIFTING' || state === 'CRITICAL'
      ? buildReadyLabel(options.data as BadgeData, options.showStatus, options.showScore)
      : `${appearance.icon} ${appearance.label}`;

  const backgroundColor =
    theme === 'dark' ? 'rgba(17, 24, 39, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const textColor = theme === 'dark' ? '#f9fafb' : '#111827';

  return {
    label,
    accentColor: appearance.color,
    backgroundColor,
    borderColor: appearance.color,
    textColor,
  };
}

export function buildBadgeStyle(theme: ResolvedTheme, presentation: BadgePresentation): Partial<CSSStyleDeclaration> {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.65rem',
    borderRadius: '999px',
    border: `1px solid ${presentation.borderColor}`,
    backgroundColor: presentation.backgroundColor,
    color: presentation.textColor,
    fontFamily:
      '"IBM Plex Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '1.2',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    boxShadow:
      theme === 'dark'
        ? `0 8px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px ${presentation.accentColor}22`
        : `0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px ${presentation.accentColor}22`,
  };
}
