import type { ScoringProfile } from '../types';

export const SCORE_PROFILES: Record<string, ScoringProfile> = {
  financial: {
    name: 'financial',
    description: 'For financial claims: price data, exchange reserves, market cap',
    completenessNote: 'How many independent financial sources confirm this claim',
    parityNote: 'How closely sources agree on the numerical value',
    freshnessNote: 'Financial data decays fastest and depends on recency',
    thresholds: { stable: 80, drifting: 55 },
  },
  research: {
    name: 'research',
    description: 'For research claims: papers, studies, academic consensus',
    completenessNote: 'How many peer-reviewed or authoritative sources cover this claim',
    parityNote: 'How closely sources agree on findings and conclusions',
    freshnessNote: 'Research claims decay slowly and tolerate older evidence',
    thresholds: { stable: 75, drifting: 50 },
  },
  news: {
    name: 'news',
    description: 'For news and current-events claims',
    completenessNote: 'How many independent news sources have reported this claim',
    parityNote: 'How consistently sources describe the same event',
    freshnessNote: 'News claims decay quickly and require recent sourcing',
    thresholds: { stable: 70, drifting: 45 },
  },
  general: {
    name: 'general',
    description: 'General-purpose profile for claims without a specific domain',
    completenessNote: 'Source coverage across the available data set',
    parityNote: 'Agreement across the sources you collected',
    freshnessNote: 'Standard freshness expectations for mixed claim types',
    thresholds: { stable: 75, drifting: 50 },
  },
};
