import type { DataSpec } from '@uvrn/core';

import type {
  DedupConfig,
  FarmResult,
  FarmSource,
  RankedSource,
  SourceWeights,
} from '../types';
import {
  calculateRecencyScore,
  calculateWeightedScore,
  normalizeCredibilityScore,
} from './weighting';
import { isGroundedStanceSource } from './stance';

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

function extractProminenceValue(source: FarmSource): number | null {
  // Prefer an explicit host-supplied evidence score. This avoids the title/snippet
  // first-number trap where a number in the title (a year, "Top 10") would win.
  if (typeof source.evidenceScore === 'number' && Number.isFinite(source.evidenceScore)) {
    return source.evidenceScore;
  }

  const content = `${source.title} ${source.snippet}`.replace(/,/g, '');
  const match = content.match(NUMBER_PATTERN);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractStanceValue(source: FarmSource): number | null {
  if (
    isGroundedStanceSource(source) &&
    typeof source.stanceValue === 'number' &&
    Number.isFinite(source.stanceValue) &&
    source.stanceValue >= -1 &&
    source.stanceValue <= 1
  ) {
    return source.stanceValue;
  }
  return null;
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

/** Resolved dedup defaults — these reproduce the historical (v3) hardcoded behavior exactly. */
const DEFAULT_DEDUP: Required<DedupConfig> = {
  relativeTolerance: 0.01,
  timeWindowMs: DAY_IN_MS,
  mode: 'relative',
};

function resolveDedup(dedup?: DedupConfig): Required<DedupConfig> {
  return {
    relativeTolerance: dedup?.relativeTolerance ?? DEFAULT_DEDUP.relativeTolerance,
    timeWindowMs: dedup?.timeWindowMs ?? DEFAULT_DEDUP.timeWindowMs,
    mode: dedup?.mode ?? DEFAULT_DEDUP.mode,
  };
}

function areNearIdentical(
  a: ParsedMetricSource,
  b: ParsedMetricSource,
  dedup: Required<DedupConfig>
): boolean {
  if (dedup.mode === 'off') {
    return false;
  }

  const timeDifference = Math.abs(a.publishedAtMs - b.publishedAtMs);
  if (timeDifference > dedup.timeWindowMs) {
    return false;
  }

  const valueDifference = Math.abs(a.metricValue - b.metricValue);
  if (dedup.mode === 'absolute') {
    return valueDifference <= dedup.relativeTolerance;
  }

  const max = Math.max(Math.abs(a.metricValue), Math.abs(b.metricValue), 1);
  return valueDifference / max <= dedup.relativeTolerance;
}

export function extractRankedSources(
  farmResult: FarmResult,
  weights: SourceWeights,
  dedup?: DedupConfig,
  evidenceAxis: 'stance' | 'prominence' = 'prominence'
): RankedSource[] {
  const fetchedAtMs = parseIsoDate(farmResult.fetchedAt, Date.now());
  const usable: ParsedMetricSource[] = [];
  const prominenceUsableCount = farmResult.sources.filter(
    (source) => extractProminenceValue(source) != null
  ).length;
  for (const source of farmResult.sources) {
    const metricValue =
      evidenceAxis === 'stance'
        ? extractStanceValue(source)
        : extractProminenceValue(source);
    if (metricValue == null) {
      continue;
    }

    const publishedAtMs = parseIsoDate(source.publishedAt, fetchedAtMs);
    const credibilityScore = normalizeCredibilityScore(source.credibility);
    const recencyScore = calculateRecencyScore(publishedAtMs, fetchedAtMs);

    usable.push({
      source,
      metricValue,
      unit:
        evidenceAxis === 'stance'
          ? undefined
          : inferUnit(`${source.title} ${source.snippet}`),
      publishedAtMs,
      publishedAt: new Date(publishedAtMs).toISOString(),
      credibilityScore,
      recencyScore,
      coverageScore: 0,
      weightScore: 0,
    });
  }

  // Coverage remains evidence-quality provenance; stance only replaces the
  // agreement/delta metric (uvrn-stance-v1 §1 dual-axis rule).
  const coverageScore = farmResult.sources.length === 0
    ? 0
    : (prominenceUsableCount / farmResult.sources.length) * 100;

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

  const resolvedDedup = resolveDedup(dedup);
  const deduped: ParsedMetricSource[] = [];
  for (const candidate of ranked) {
    if (!deduped.some((existing) => areNearIdentical(existing, candidate, resolvedDedup))) {
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
