import type { NormalizationProfile } from '../types';
import { financialProfile } from '../normalize/transformers/financial';
import { generalProfile } from '../normalize/transformers/general';
import { newsProfile } from '../normalize/transformers/news';
import { researchProfile } from '../normalize/transformers/research';

export const NormalizationProfiles: Record<string, NormalizationProfile> = {
  financial: financialProfile,
  research: researchProfile,
  news: newsProfile,
  general: generalProfile,
};
