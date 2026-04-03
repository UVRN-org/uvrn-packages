import type { DataSpec } from '@uvrn/core';
import type { FarmResult, FarmSource } from '@uvrn/agent';

import type { RankedSource, SourceWeights } from '../types';
import {
  calculateRecencyScore,
  calculateWeightedScore,
  normalizeCredibilityScore,
} from './weighting';

interface ParsedMetricSource {
  source: FarmSource;
  metricValue: number;
  unit?: string;
  publishedAtMs: number;
  publishedAt: string;
  credibilityScore: number;
  recencyScore: number;
  coverageScore: number;
  weightScore: number;
}

const NUMBER_PATTERN = /[-+]?\d[\d,]*(?:\.\d+)?/;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

function parseIsoDate(value: string | undefined, fallbackMs: number): number {
  if (!value) {
    return fallbackMs;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallbackMs;
}

function inferUnit(text: string): string | undefined {
  const lowered = text.toLowerCase();

  if (/%|percent\b/.test(lowered)) {
    return '%';
  }
  if (/\$|usd\b|dollar\b/.test(lowered)) {
    return 'USD';
  }
  if (/btc\b|bitcoin\b/.test(lowered)) {
    return 'BTC';
  }
  if (/eth\b|ethereum\b/.test(lowered)) {
    return 'ETH';
  }
  if (/sol\b|solana\b/.test(lowered)) {
    return 'SOL';
  }

  return undefined;
}

function extractMetricValue(source: FarmSource): number | null {
  const content = `${source.title} ${source.snippet}`.replace(/,/g, '');
  const match = content.match(NUMBER_PATTERN);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableHash(input: string): string {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

function toDataSpec(parsed: ParsedMetricSource, index: number): DataSpec {
  return {
    id: `source-${index + 1}-${stableHash(parsed.source.url)}`,
    label: parsed.source.title || `Source ${index + 1}`,
    sourceKind: 'metric',
    originDocIds: [parsed.source.url],
    metrics: [
      {
        key: 'consensus_value',
        value: parsed.metricValue,
        unit: parsed.unit,
        ts: parsed.publishedAt,
      },
    ],
  };
}

function areNearIdentical(a: ParsedMetricSource, b: ParsedMetricSource): boolean {
  const max = Math.max(Math.abs(a.metricValue), Math.abs(b.metricValue), 1);
  const relativeDifference = Math.abs(a.metricValue - b.metricValue) / max;
  const timeDifference = Math.abs(a.publishedAtMs - b.publishedAtMs);

  return relativeDifference <= 0.01 && timeDifference <= DAY_IN_MS;
}

export function extractRankedSources(
  farmResult: FarmResult,
  weights: SourceWeights
): RankedSource[] {
  const fetchedAtMs = parseIsoDate(farmResult.fetchedAt, Date.now());
  const usable: ParsedMetricSource[] = [];
  for (const source of farmResult.sources) {
    const metricValue = extractMetricValue(source);
    if (metricValue == null) {
      continue;
    }

    const publishedAtMs = parseIsoDate(source.publishedAt, fetchedAtMs);
    const credibilityScore = normalizeCredibilityScore(source.credibility);
    const recencyScore = calculateRecencyScore(publishedAtMs, fetchedAtMs);

    usable.push({
      source,
      metricValue,
      unit: inferUnit(`${source.title} ${source.snippet}`),
      publishedAtMs,
      publishedAt: new Date(publishedAtMs).toISOString(),
      credibilityScore,
      recencyScore,
      coverageScore: 0,
      weightScore: 0,
    });
  }

  const coverageScore = farmResult.sources.length === 0
    ? 0
    : (usable.length / farmResult.sources.length) * 100;

  const ranked = usable
    .map((parsed) => {
      const weightScore = calculateWeightedScore(
        parsed.credibilityScore,
        parsed.recencyScore,
        coverageScore,
        weights
      );

      return {
        ...parsed,
        coverageScore,
        weightScore,
      };
    })
    .sort((left, right) => right.weightScore - left.weightScore);

  const deduped: ParsedMetricSource[] = [];
  for (const candidate of ranked) {
    if (!deduped.some((existing) => areNearIdentical(existing, candidate))) {
      deduped.push(candidate);
    }
  }

  return deduped.map((parsed, index) => ({
    dataSpec: toDataSpec(parsed, index),
    weightScore: parsed.weightScore,
    credibilityScore: parsed.credibilityScore,
    recencyScore: parsed.recencyScore,
    coverageScore: parsed.coverageScore,
    metricValue: parsed.metricValue,
    publishedAt: parsed.publishedAt,
    unit: parsed.unit,
    originalSource: parsed.source,
  }));
}

export function calculateAgreementScore(rankedSources: RankedSource[]): number {
  if (rankedSources.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const source of rankedSources) {
    const key = source.metricValue.toFixed(2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  return (maxCount / rankedSources.length) * 100;
}

export function buildBundleId(claim: string, dataSpecs: DataSpec[]): string {
  const seed = `${claim}|${dataSpecs.map((spec) => spec.id).join('|')}`;
  return `consensus-${stableHash(seed)}`;
}
