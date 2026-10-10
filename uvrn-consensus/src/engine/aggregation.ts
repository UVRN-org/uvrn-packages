import type { DataSpec, QuantityKind, UnitSource } from '@uvrn/core';

import type {
  DedupConfig,
  FarmResult,
  FarmSource,
  HostProvRelations,
  RankedSource,
  RankedSourcesResult,
  SourceWeights,
  TimestampSource,
  ValueSource,
} from '../types';
import {
  calculateRecencyScore,
  calculateWeightedScore,
  resolveCredibilityForWeighting,
} from './weighting';
import { isGroundedStanceSource } from './stance';

interface ParsedMetricSource {
  source: FarmSource;
  metricValue: number;
  unit?: string;
  unitSource: UnitSource;
  quantityKind?: QuantityKind;
  measuredAt?: string;
  appliesTo?: string;
  obsStatus?: string;
  stake?: string;
  originId: string;
  publishedAtMs: number;
  publishedAt: string;
  measuredAtMs: number | null;
  credibilityScore: number;
  declaredCredibilityScore?: number;
  learnedCredibilityScore?: number;
  recencyScore: number;
  coverageScore: number;
  weightScore: number;
  valueSource: ValueSource;
  timestampSource: TimestampSource;
}

const NUMBER_PATTERN = /[-+]?\d[\d,]*(?:\.\d+)?/g;
const DAY_IN_MS = 1000 * 60 * 60 * 24;
const BARE_YEAR_PATTERN = /^(?:19|20)\d{2}$/;
const LIST_COUNT_AFTER = /^\s*(things|ways|tips|reasons|ideas|facts|best|top)\b/i;

function parseIsoDate(value: string | undefined, fallbackMs: number): number {
  if (!value) {
    return fallbackMs;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallbackMs;
}

function hasDeclaredTimestamp(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return Number.isFinite(timestampParse(value));
}

function timestampParse(value: string): number {
  return Date.parse(value);
}

/**
 * Text-guessed unit tokens. NEVER authoritative for comparability.
 * Output must be tagged `unitSource: 'inferred'`.
 */
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

function resolveUnit(
  source: FarmSource,
  evidenceAxis: 'stance' | 'prominence'
): { unit?: string; unitSource: UnitSource } {
  if (evidenceAxis === 'stance') {
    return { unitSource: 'none' };
  }
  if (typeof source.unit === 'string' && source.unit.trim().length > 0) {
    return { unit: source.unit.trim(), unitSource: 'declared' };
  }
  const guessed = inferUnit(`${source.title} ${source.snippet}`);
  if (guessed) {
    return { unit: guessed, unitSource: 'inferred' };
  }
  return { unitSource: 'none' };
}

/**
 * Host-declared PROV → origin identity. Value equality MUST NOT create identity.
 */
export function resolveOriginId(source: FarmSource): string {
  if (typeof source.originId === 'string' && source.originId.trim().length > 0) {
    return source.originId.trim();
  }
  const prov: HostProvRelations | undefined = source.prov;
  if (prov) {
    const edge =
      prov.hadPrimarySource ??
      prov.wasQuotedFrom ??
      prov.wasDerivedFrom ??
      prov.wasRevisionOf ??
      prov.wasAttributedTo;
    if (typeof edge === 'string' && edge.trim().length > 0) {
      return edge.trim();
    }
  }
  return source.url;
}

/** Returns true when the source must be excluded from the observation pool as a forecast. */
export function isExcludedForecast(
  source: FarmSource,
  evalTimeMs: number
): { exclude: boolean; recordObsStatus?: string } {
  if (source.obsStatus !== 'F') {
    return { exclude: false };
  }
  if (!hasDeclaredTimestamp(source.appliesTo)) {
    return { exclude: true, recordObsStatus: 'F' };
  }
  const appliesMs = timestampParse(source.appliesTo!);
  if (appliesMs < evalTimeMs) {
    // Backfilled forecast over an elapsed period → I (kept in pool).
    return { exclude: false, recordObsStatus: 'I' };
  }
  return { exclude: true, recordObsStatus: 'F' };
}

function isListCountContext(content: string, index: number, token: string): boolean {
  const before = content.slice(Math.max(0, index - 12), index);
  const after = content.slice(index + token.length, index + token.length + 16);
  if (/\btop\s+$/i.test(before)) {
    return true;
  }
  return LIST_COUNT_AFTER.test(after);
}

function scrapeProminenceValue(source: FarmSource): number | null {
  const content = `${source.title} ${source.snippet}`.replace(/,/g, '');
  NUMBER_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = NUMBER_PATTERN.exec(content)) !== null) {
    const token = match[0];
    if (BARE_YEAR_PATTERN.test(token)) {
      continue;
    }
    if (isListCountContext(content, match.index, token)) {
      continue;
    }
    const parsed = Number.parseFloat(token);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export interface ProminenceExtraction {
  value: number | null;
  valueSource: ValueSource;
}

export function extractProminenceValue(
  source: FarmSource,
  allowTextScrape = false
): ProminenceExtraction {
  if (typeof source.evidenceScore === 'number' && Number.isFinite(source.evidenceScore)) {
    return { value: source.evidenceScore, valueSource: 'declared' };
  }

  if (!allowTextScrape) {
    return { value: null, valueSource: 'none' };
  }

  const scraped = scrapeProminenceValue(source);
  if (scraped == null) {
    return { value: null, valueSource: 'none' };
  }

  return { value: scraped, valueSource: 'scraped' };
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
  const metric: DataSpec['metrics'][number] = {
    key: 'consensus_value',
    value: parsed.metricValue,
  };

  if (parsed.unit && (parsed.unitSource === 'declared' || parsed.unitSource === 'inferred')) {
    metric.unit = parsed.unit;
    metric.unitSource = parsed.unitSource;
  }

  if (parsed.quantityKind) {
    metric.quantityKind = parsed.quantityKind;
  }
  if (parsed.measuredAt) {
    metric.measuredAt = parsed.measuredAt;
    // Freshness / measurement time only — never publish time (SPEC §5 / P2).
    metric.ts = parsed.measuredAt;
  }
  if (parsed.appliesTo) {
    metric.appliesTo = parsed.appliesTo;
  }
  if (parsed.obsStatus) {
    metric.obsStatus = parsed.obsStatus;
  }
  if (parsed.stake) {
    metric.stake = parsed.stake;
  }
  if (parsed.source.codeLists) {
    metric.codeLists = parsed.source.codeLists;
  }

  return {
    id: `source-${index + 1}-${stableHash(parsed.source.url)}`,
    label: parsed.source.title || `Source ${index + 1}`,
    sourceKind: 'metric',
    originDocIds: [parsed.source.url],
    metrics: [metric],
  };
}

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

/**
 * Agreement counts distinct origins (SPEC §7.2), not documents.
 * Each origin casts one vote at its first-seen representative value.
 */
export function calculateOriginAgreementScore(
  sources: Array<{ metricValue: number; originId: string }>
): number {
  if (sources.length === 0) {
    return 0;
  }

  const originValue = new Map<string, number>();
  for (const source of sources) {
    if (!originValue.has(source.originId)) {
      originValue.set(source.originId, source.metricValue);
    }
  }

  const counts = new Map<string, number>();
  for (const value of originValue.values()) {
    const key = value.toFixed(2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  return (maxCount / originValue.size) * 100;
}

/**
 * Origin-aware agreement over the ranked list's originIds.
 * For honest pre-dedup scoring, prefer `RankedSourcesResult.originAgreementScore`.
 */
export function calculateAgreementScore(rankedSources: RankedSource[]): number {
  if (rankedSources.length === 0) {
    return 0;
  }
  return calculateOriginAgreementScore(
    rankedSources.map((source) => ({
      metricValue: source.metricValue,
      originId: source.originId,
    }))
  );
}

function transcriptionCorroborationFor(observationPool: ParsedMetricSource[]): {
  perOriginExtra: Map<string, number>;
  totalExtra: number;
  distinctOrigins: number;
} {
  const counts = new Map<string, number>();
  for (const parsed of observationPool) {
    counts.set(parsed.originId, (counts.get(parsed.originId) ?? 0) + 1);
  }
  let totalExtra = 0;
  const perOriginExtra = new Map<string, number>();
  for (const [originId, count] of counts) {
    const extra = Math.max(0, count - 1);
    perOriginExtra.set(originId, extra);
    totalExtra += extra;
  }
  return { perOriginExtra, totalExtra, distinctOrigins: counts.size };
}

/**
 * Pipeline order (SPEC §7.3 / Adversary P7/P12):
 * 1. Parse usable measurements + origin identity from host PROV
 * 2. Exclude forecasts from observation pool (reported)
 * 3. Origin agreement + restatement signals on **pre-dedup** pool
 * 4. Value-similarity dedup for engine collapse (must not upgrade origin identity)
 */
export function extractRankedSourcesWithHonesty(
  farmResult: FarmResult,
  weights: SourceWeights,
  dedup?: DedupConfig,
  evidenceAxis: 'stance' | 'prominence' = 'prominence',
  allowTextScrape = false,
  /** Host-declared evaluation clock for F/I rule (ms). Defaults to fetchedAt. */
  evalTimeMs?: number,
  /**
   * Opt-in learned credibility (BP-23). Default off — declared constants stay in force.
   */
  credibility?: {
    useLearned?: boolean;
    byOrigin?: Record<string, number>;
  }
): RankedSourcesResult {
  const fetchedAtMs = parseIsoDate(farmResult.fetchedAt, Date.now());
  const evaluationMs = evalTimeMs ?? fetchedAtMs;

  const prominenceExtracted = farmResult.sources.map((source) =>
    extractProminenceValue(source, allowTextScrape)
  );
  const prominenceUsableCount = prominenceExtracted.filter(
    (extraction) => extraction.value != null
  ).length;
  const unusableSourceCount = farmResult.sources.length - prominenceUsableCount;

  // Farm-wide publish-time inference count (BP-15 honesty stamp — unchanged meaning).
  const inferredPublishTimestampCount = farmResult.sources.filter(
    (source) => !hasDeclaredTimestamp(source.publishedAt)
  ).length;

  const observationPool: ParsedMetricSource[] = [];
  let excludedForecastCount = 0;

  for (let index = 0; index < farmResult.sources.length; index += 1) {
    const source = farmResult.sources[index]!;
    const prominence = prominenceExtracted[index]!;

    let metricValue: number | null;
    let valueSource: ValueSource;

    if (evidenceAxis === 'stance') {
      metricValue = extractStanceValue(source);
      valueSource = metricValue != null ? 'declared' : 'none';
    } else {
      metricValue = prominence.value;
      valueSource = prominence.valueSource;
    }

    if (metricValue == null) {
      continue;
    }

    const forecastGate = isExcludedForecast(source, evaluationMs);
    if (forecastGate.exclude) {
      excludedForecastCount += 1;
      continue;
    }

    const hasMeasured = hasDeclaredTimestamp(source.measuredAt);
    const timestampSource: TimestampSource = hasMeasured ? 'declared' : 'inferred';
    const measuredAtMs = hasMeasured ? timestampParse(source.measuredAt!) : null;
    const publishedAtMs = parseIsoDate(source.publishedAt, fetchedAtMs);
    const { unit, unitSource } = resolveUnit(source, evidenceAxis);

    const recencyScore =
      timestampSource === 'declared' && measuredAtMs != null
        ? calculateRecencyScore(measuredAtMs, fetchedAtMs)
        : 0;

    const originId = resolveOriginId(source);
    const resolvedCred = resolveCredibilityForWeighting({
      declared: source.credibility,
      learned: credibility?.byOrigin?.[originId],
      useLearned: credibility?.useLearned === true,
    });

    observationPool.push({
      source,
      metricValue,
      unit,
      unitSource,
      quantityKind: source.quantityKind,
      measuredAt: hasMeasured ? source.measuredAt : undefined,
      appliesTo: source.appliesTo,
      obsStatus: forecastGate.recordObsStatus ?? source.obsStatus,
      stake: source.stake,
      originId,
      publishedAtMs,
      publishedAt: new Date(publishedAtMs).toISOString(),
      measuredAtMs,
      credibilityScore: resolvedCred.weightScore,
      declaredCredibilityScore:
        credibility?.useLearned === true ? resolvedCred.declaredScore : undefined,
      learnedCredibilityScore: resolvedCred.learnedScore,
      recencyScore,
      coverageScore: 0,
      weightScore: 0,
      valueSource,
      timestampSource,
    });
  }

  const coverageScore =
    farmResult.sources.length === 0
      ? 0
      : (prominenceUsableCount / farmResult.sources.length) * 100;

  const { perOriginExtra, totalExtra, distinctOrigins } =
    transcriptionCorroborationFor(observationPool);

  const originAgreementScore = calculateOriginAgreementScore(
    observationPool.map((parsed) => ({
      metricValue: parsed.metricValue,
      originId: parsed.originId,
    }))
  );

  const ranked = observationPool
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

  // inferredTimestampCount: keep BP-15 farm-wide publish inference for stamp compat;
  // measuredAt-inferred freshness is already reflected in recencyScore === 0.
  const inferredTimestampCount = inferredPublishTimestampCount;

  return {
    ranked: deduped.map((parsed, index) => ({
      dataSpec: toDataSpec(parsed, index),
      weightScore: parsed.weightScore,
      credibilityScore: parsed.credibilityScore,
      recencyScore: parsed.recencyScore,
      coverageScore: parsed.coverageScore,
      metricValue: parsed.metricValue,
      publishedAt: parsed.publishedAt,
      unit: parsed.unit,
      unitSource: parsed.unitSource,
      quantityKind: parsed.quantityKind,
      measuredAt: parsed.measuredAt,
      appliesTo: parsed.appliesTo,
      obsStatus: parsed.obsStatus,
      stake: parsed.stake,
      originId: parsed.originId,
      originalSource: parsed.source,
      valueSource: parsed.valueSource,
      timestampSource: parsed.timestampSource,
      unusableSourceCount,
      inferredTimestampCount,
      excludedForecastCount,
      transcriptionCorroboration: perOriginExtra.get(parsed.originId) ?? 0,
      distinctOriginCount: distinctOrigins,
      ...(parsed.declaredCredibilityScore != null
        ? { declaredCredibilityScore: parsed.declaredCredibilityScore }
        : {}),
      ...(parsed.learnedCredibilityScore != null
        ? { learnedCredibilityScore: parsed.learnedCredibilityScore }
        : {}),
    })),
    unusableSourceCount,
    inferredTimestampCount,
    excludedForecastCount,
    observationSourceCount: observationPool.length,
    distinctOriginCount: distinctOrigins,
    transcriptionCorroboration: totalExtra,
    originAgreementScore,
  };
}

export function extractRankedSources(
  farmResult: FarmResult,
  weights: SourceWeights,
  dedup?: DedupConfig,
  evidenceAxis: 'stance' | 'prominence' = 'prominence',
  allowTextScrape = false
): RankedSource[] {
  return extractRankedSourcesWithHonesty(
    farmResult,
    weights,
    dedup,
    evidenceAxis,
    allowTextScrape
  ).ranked;
}

export function buildBundleId(claim: string, dataSpecs: DataSpec[]): string {
  const seed = `${claim}|${dataSpecs.map((spec) => spec.id).join('|')}`;
  return `consensus-${stableHash(seed)}`;
}
