import { useEffect, useState, type CSSProperties } from 'react';
import type { BadgeData, BadgeProps, BadgeStatus } from '../types';
import {
  DEFAULT_API_URL,
  DEFAULT_CACHE_MS,
  buildBadgeStyle,
  getBadgePresentation,
  loadBadgeData,
  resolveTheme,
} from '../runtime/badge';

interface BadgeState {
  status: BadgeStatus;
  data: BadgeData | null;
}

export function ConsensusBadge({
  claimId,
  apiUrl = DEFAULT_API_URL,
  theme = 'auto',
  showScore = true,
  showStatus = true,
  cacheMs = DEFAULT_CACHE_MS,
  className,
}: BadgeProps): JSX.Element {
  const [state, setState] = useState<BadgeState>({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null });

    void loadBadgeData(claimId, apiUrl, cacheMs)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [claimId, apiUrl, cacheMs]);

  const resolvedTheme = resolveTheme(theme);
  const stateKey =
    state.status === 'ready' ? state.data?.status ?? 'error' : state.status;
  const presentation = getBadgePresentation(stateKey, resolvedTheme, {
    data: state.data,
    showScore,
    showStatus,
  });

  return (
    <span
      role="status"
      aria-live="polite"
      className={className}
      data-uvrn-status={stateKey}
      style={buildBadgeStyle(resolvedTheme, presentation) as CSSProperties}
    >
      {presentation.label}
    </span>
  );
}
