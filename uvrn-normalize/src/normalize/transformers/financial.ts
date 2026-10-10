import type { FarmSource, NormalizationProfile } from '../../types';

import {
  extractNumericValue,
  extractTextValue,
  finalizeNormalizedSource,
  normalizeCredibilityValue,
  normalizePrecisionValue,
  normalizeTimestampValue,
} from './utils';

export const financialProfile: NormalizationProfile = {
  name: 'financial',
  description: 'Example/default financial profile for prices and market evidence.',
  transform(source: FarmSource) {
    const text = `${source.title} ${source.snippet}`;
    const numericValue = extractNumericValue(text);
    const unit = numericValue == null ? 'text' : 'USD';
    const value = numericValue == null
      ? extractTextValue(source)
      : this.normalizePrecision(numericValue, unit);

    return finalizeNormalizedSource(source, {
      name: source.title,
      value,
      unit,
      timestamp: this.normalizeTimestamp(source.publishedAt),
      credibility: normalizeCredibilityValue(source.credibility, 0.7),
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
