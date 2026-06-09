import type { FarmSource, NormalizationProfile } from '../../types';

import {
  extractNumericValue,
  extractTextValue,
  finalizeNormalizedSource,
  normalizeCredibilityValue,
  normalizePrecisionValue,
  normalizeTimestampValue,
} from './utils';

export const generalProfile: NormalizationProfile = {
  name: 'general',
  description: 'Example/default profile for best-effort normalization across mixed source types.',
  transform(source: FarmSource) {
    // Prefer an explicit host-supplied evidence score over regex-parsing the
    // title/snippet, so a number in the title can't override the intended value.
    const numericValue =
      typeof source.evidenceScore === 'number' && Number.isFinite(source.evidenceScore)
        ? source.evidenceScore
        : extractNumericValue(`${source.title} ${source.snippet}`);

    return finalizeNormalizedSource(source, {
      name: source.title,
      value: numericValue ?? extractTextValue(source),
      unit: numericValue == null ? 'text' : 'number',
      timestamp: this.normalizeTimestamp(source.publishedAt),
      credibility: normalizeCredibilityValue(source.credibility, 0.5),
      normalizer: this.name,
    });
  },
  normalizeTimestamp(timestamp: unknown): number {
    return normalizeTimestampValue(timestamp);
  },
  normalizePrecision(value: number, unit: string): number {
    return normalizePrecisionValue(value, unit);
  },
};
