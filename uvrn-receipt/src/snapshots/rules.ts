/**
 * Deterministic idea-snapshot rules for humanView (BP-22).
 * Law 5: possible reasons, never verdicts. Law 6: interpretation never hashed.
 * Rules read only the receipt's own observed fields/tags — never claim-text heuristics.
 */

import type { IdeaSnapshot, NetworkReceipt } from '../types';

/** Score facts used by spread rules (subset of HumanViewOptions.scores). */
export interface SnapshotScoreFacts {
  absoluteConsensusValue?: {
    median: number | null;
    n: number;
    min: number | null;
    max: number | null;
  };
}

export type { IdeaSnapshot };

export interface SnapshotRule {
  id: string;
  /** Human-readable pattern description (also used as `basis`). */
  pattern: string;
  match: (ctx: SnapshotContext) => boolean;
  text: (ctx: SnapshotContext) => string;
}

export interface SnapshotContext {
  tags: string[];
  sourceCount: number;
  originCount: number | null;
  inferredTimestampCount: number;
  scrapedValueCount: number;
  obsStatuses: string[];
  hasComparabilityRefusal: boolean;
  absoluteSpread: { min: number; max: number; n: number } | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const PROV_KEYS = [
  'wasDerivedFrom',
  'hadPrimarySource',
  'wasQuotedFrom',
  'wasRevisionOf',
  'wasAttributedTo',
] as const;

function collectHostObservations(receipt: NetworkReceipt): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;
    for (const key of ['sources', 'hostSources'] as const) {
      const arr = node[key];
      if (!Array.isArray(arr)) continue;
      for (const src of arr) {
        if (isRecord(src) && (src.value !== undefined || src.unit !== undefined || src.prov !== undefined || src.obsStatus !== undefined || src.timestampSource !== undefined || src.valueSource !== undefined)) {
          out.push(src);
        }
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'sources' || k === 'hostSources') continue;
      if (isRecord(v) || Array.isArray(v)) visit(v);
    }
  };
  visit(receipt.payload);
  return out;
}

function originKey(obs: Record<string, unknown>): string {
  const prov = obs.prov;
  if (isRecord(prov)) {
    for (const key of PROV_KEYS) {
      const v = prov[key];
      if (typeof v === 'string' && v.length > 0) return `prov:${key}:${v}`;
    }
  }
  if (typeof obs.originId === 'string' && obs.originId.length > 0) {
    return `originId:${obs.originId}`;
  }
  if (typeof obs.url === 'string' && obs.url.length > 0) return `url:${obs.url}`;
  return `anon:${JSON.stringify(obs).slice(0, 40)}`;
}

/** Build observation context from receipt fields/tags only (no claim-text scrape). */
export function buildSnapshotContext(
  receipt: NetworkReceipt,
  options: { scores?: SnapshotScoreFacts } = {},
): SnapshotContext {
  const tags = Array.isArray(receipt.tags)
    ? receipt.tags.filter((t): t is string => typeof t === 'string')
    : [];
  const observations = collectHostObservations(receipt);
  const origins = new Set(observations.map(originKey));
  const inferredTimestampCount = observations.filter(
    (o) => o.timestampSource === 'inferred',
  ).length;
  const scrapedValueCount = observations.filter((o) => o.valueSource === 'scraped').length;
  const obsStatuses = observations
    .map((o) => o.obsStatus)
    .filter((s): s is string => typeof s === 'string');

  const payload = receipt.payload as Record<string, unknown>;
  const measurements = Array.isArray(payload.measurements)
    ? payload.measurements
    : [];
  const hasComparabilityRefusal =
    tags.some((t) => t.includes('comparability-refusal') || t.includes('dimension-mismatch')) ||
    measurements.some(
      (m) =>
        isRecord(m) &&
        (m.type === 'comparability-refusal' ||
          (typeof m.explanation === 'string' &&
            m.explanation.includes('comparability-refusal'))),
    );

  const abs = options.scores?.absoluteConsensusValue;
  const absoluteSpread =
    abs &&
    typeof abs.min === 'number' &&
    typeof abs.max === 'number' &&
    abs.n >= 2
      ? { min: abs.min, max: abs.max, n: abs.n }
      : null;

  // Source count: prefer envelope nodes / human source rows; fall back to observations
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const sourceCount =
    nodes.length > 0
      ? nodes.length
      : observations.length > 0
        ? observations.length
        : tags.filter((t) => t.startsWith('source:')).length;

  return {
    tags,
    sourceCount,
    originCount: observations.length > 0 ? origins.size : null,
    inferredTimestampCount,
    scrapedValueCount,
    obsStatuses,
    hasComparabilityRefusal,
    absoluteSpread,
  };
}

/**
 * Ordered rule catalogue. Order is normative for multi-fire determinism.
 * Sentences use "may" — never truth, motive, or trustworthiness verdicts.
 */
export const SNAPSHOT_RULES: SnapshotRule[] = [
  {
    id: 'few-origins-many-sources',
    pattern: 'tag/field: sourceCount > originCount when origins are host-declared',
    match: (ctx) =>
      ctx.originCount !== null &&
      ctx.originCount >= 1 &&
      ctx.sourceCount >= 2 &&
      ctx.originCount < ctx.sourceCount,
    text: (ctx) =>
      `With ${ctx.sourceCount} sources tracing to ${ctx.originCount} declared origin` +
      `${ctx.originCount === 1 ? '' : 's'}, the apparent agreement may rest on fewer ` +
      `independent measurements than the source count suggests.`,
  },
  {
    id: 'inferred-timestamps',
    pattern: "field: timestampSource === 'inferred' on one or more observations",
    match: (ctx) => ctx.inferredTimestampCount > 0,
    text: (ctx) =>
      `${ctx.inferredTimestampCount} observation` +
      `${ctx.inferredTimestampCount === 1 ? '' : 's'} carry an inferred timestamp, so ` +
      `the freshness signal may be weaker than a host-declared measuredAt would support.`,
  },
  {
    id: 'scraped-values',
    pattern: "field: valueSource === 'scraped' on one or more observations",
    match: (ctx) => ctx.scrapedValueCount > 0,
    text: (ctx) =>
      `${ctx.scrapedValueCount} value` +
      `${ctx.scrapedValueCount === 1 ? '' : 's'} were marked scraped from text rather than ` +
      `host-declared, which may affect how much weight a reader gives the numeric cluster.`,
  },
  {
    id: 'mixed-obs-status',
    pattern: 'field: mixed SDMX obsStatus codes in the observation pool',
    match: (ctx) => new Set(ctx.obsStatuses).size >= 2,
    text: () =>
      'Estimated, provisional, or other observation-status codes sit alongside normal ' +
      'observations in this pool, so the cluster may mix different kinds of figure.',
  },
  {
    id: 'comparability-refusal',
    pattern: 'tag/measurement: comparability-refusal present on the receipt',
    match: (ctx) => ctx.hasComparabilityRefusal,
    text: () =>
      'A comparability refusal is recorded on this receipt, so no delta may have been ' +
      'produced for at least one cross-dimension pair.',
  },
  {
    id: 'wide-consensus-spread',
    pattern: 'scoreCard.absoluteConsensusValue: wide min–max around the median',
    match: (ctx) => {
      if (!ctx.absoluteSpread) return false;
      const { min, max } = ctx.absoluteSpread;
      if (min === 0 && max === 0) return false;
      const span = Math.abs(max - min);
      const scale = Math.max(Math.abs(min), Math.abs(max), 1);
      return span / scale >= 0.2;
    },
    text: (ctx) =>
      `Retained values span ${ctx.absoluteSpread!.min}–${ctx.absoluteSpread!.max} ` +
      `(n=${ctx.absoluteSpread!.n}), so sources may agree within tolerance while still ` +
      `spreading widely around the median.`,
  },
];

export interface BuildIdeaSnapshotsOptions {
  scores?: SnapshotScoreFacts;
  /**
   * Optional model-layer seam. Default false — off. When true, appends a clearly
   * marked model-generated placeholder without loading keys or calling a network model.
   */
  enableModelSnapshots?: boolean;
}

/**
 * Evaluate rules in fixed order. Same receipt → same snapshots (determinism).
 * Model layer is off by default and never loads a key.
 */
export function buildIdeaSnapshots(
  receipt: NetworkReceipt,
  options: BuildIdeaSnapshotsOptions = {},
): IdeaSnapshot[] {
  const ctx = buildSnapshotContext(receipt, options);
  const out: IdeaSnapshot[] = [];
  for (const rule of SNAPSHOT_RULES) {
    if (!rule.match(ctx)) continue;
    out.push({
      id: rule.id,
      basis: rule.pattern,
      text: rule.text(ctx),
      generator: 'rules',
    });
  }

  if (options.enableModelSnapshots === true) {
    out.push({
      id: 'model-seam',
      basis: 'opt-in model layer (disabled by default; no live model call in this seam)',
      text:
        '[model-generated] A model-authored reading may be attached here when a host ' +
        'explicitly enables the model layer; this placeholder does not assert claim truth.',
      generator: 'model',
      modelGenerated: true,
    });
  }

  return out;
}
