import type { FarmSource, NormalizationProfile } from '../../types';

import {
  extractTextValue,
  finalizeNormalizedSource,
  normalizeCredibilityValue,
  normalizePrecisionValue,
  normalizeTimestampValue,
} from './utils';

export const newsProfile: NormalizationProfile = {
  name: 'news',
  description: 'Example/default profile for headline and article summaries.',
  transform(source: FarmSource) {
    return finalizeNormalizedSource(source, {
      name: source.title,
      value: extractTextValue(source),
      unit: 'text',
      timestamp: this.normalizeTimestamp(source.publishedAt),
      credibility: normalizeCredibilityValue(source.credibility, 0.6),
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
