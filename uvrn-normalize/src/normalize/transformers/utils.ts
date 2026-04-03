import type { FarmSource, NormalizedSource } from '../../types';

const GENERIC_PROVIDER_TOKENS = new Set(['farm', 'connector', 'source', 'provider']);

export function normalizeTimestampValue(timestamp: unknown): number {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return timestamp < 1_000_000_000_000 ? timestamp * 1_000 : timestamp;
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  if (typeof timestamp === 'string') {
    const numeric = Number(timestamp);
    if (!Number.isNaN(numeric)) {
      return normalizeTimestampValue(numeric);
    }

    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

export function normalizeCredibilityValue(value: number | undefined, fallback: number): number {
  if (value == null) {
    return fallback;
  }

  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

export function normalizePrecisionValue(value: number, unit: string): number {
  if (unit === 'USD') {
    return Math.round(value * 100) / 100;
  }

  return value;
}

export function extractNumericValue(text: string): number | null {
  const match = text.match(/(?:USD\s*)?\$?\s*(-?\d+(?:,\d{3})*(?:\.\d+)?)/i);

  if (!match) {
    return null;
  }

  const numeric = Number(match[1].replace(/,/g, ''));
  return Number.isNaN(numeric) ? null : numeric;
}

export function extractTextValue(source: FarmSource): string {
  const preferred = source.snippet.trim();
  if (preferred.length > 0) {
    return preferred;
  }

  return source.title.trim();
}

export function finalizeNormalizedSource(
  source: FarmSource,
  partial: Omit<NormalizedSource, 'rawData'> & { rawData?: unknown }
): NormalizedSource {
  return {
    ...partial,
    rawData: partial.rawData ?? source,
  };
}

export function normalizeRegistrationKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function tokenizeRegistrationKey(key: string): string[] {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !GENERIC_PROVIDER_TOKENS.has(token));
}
