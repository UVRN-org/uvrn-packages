/**
 * Project a UVRN receipt into a separate JSON-LD object graph.
 *
 * Law (SPEC/uvrn-typed-observation-v1 §11): the linked-data form is a projection —
 * never an in-place mutation of a hash input, never a hash field.
 */

import {
  PROV_RELATION_KEYS,
  UVRN_RECEIPT_CONTEXT_IRI,
  type ProvRelationKey,
} from './context';

/** Fields deliberately omitted from the graph (no honest external IRI mapping). */
export const DELIBERATELY_UNMAPPED_FIELDS = [
  'payload', // opaque protocol object; not re-typed into a false vocabulary
  'signature', // signing envelope — honesty vocabulary elsewhere; not PROV
  'humanView', // render-only; BP-22 snapshots stay out of linked-data claims
  'sdk', // build identity, not an observation axis
  'links', // internal receipt-link rels lack a pinned external vocabulary here
  'chainId',
  'unitSource', // UVRN honesty tag (declared|inferred|none), not UCUM
  'originId', // host-local id; not upgraded to a PROV edge
  'timestampSource', // honesty tag from scrape pipeline
  'credibility', // local score, not an external vocab term
  'evidenceScore', // local score channel
  'snippet',
  'title',
  'url', // may appear as @id when present; bare string urls without id role omitted as claims
] as const;

export interface JsonLdProjection {
  '@context': string;
  '@type': 'uvrn:NetworkReceiptProjection';
  projectionOf?: string;
  schemaVersion?: string;
  receiptHash?: string;
  kind?: string;
  claim?: unknown;
  source?: string;
  action?: string;
  occurredAt?: string;
  topic?: unknown;
  tags?: unknown;
  narrative?: string;
  observations: Record<string, unknown>[];
  omittedFields: string[];
  [key: string]: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Project only host-declared PROV edges; never mint undeclared relations. */
function projectProv(prov: unknown): Record<string, string> | undefined {
  if (!isRecord(prov)) return undefined;
  const out: Record<string, string> = {};
  for (const key of PROV_RELATION_KEYS) {
    const v = prov[key];
    if (typeof v === 'string' && v.length > 0) {
      out[key] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function projectObservation(
  raw: Record<string, unknown>,
  index: number,
): Record<string, unknown> | null {
  const hasTypedAxis =
    raw.value !== undefined ||
    raw.quantityKind !== undefined ||
    raw.unit !== undefined ||
    raw.measuredAt !== undefined ||
    raw.publishedAt !== undefined ||
    raw.appliesTo !== undefined ||
    raw.obsStatus !== undefined ||
    raw.prov !== undefined ||
    raw.stake !== undefined;

  if (!hasTypedAxis) return null;

  const node: Record<string, unknown> = {
    '@type': 'uvrn:TypedObservation',
    '@id':
      typeof raw.url === 'string'
        ? raw.url
        : `urn:uvrn:observation:${index}`,
  };

  if (typeof raw.quantityKind === 'string') node.quantityKind = raw.quantityKind;
  if (typeof raw.unit === 'string') node.unit = raw.unit;
  if (typeof raw.value === 'number' && Number.isFinite(raw.value)) node.value = raw.value;
  if (typeof raw.publishedAt === 'string') node.publishedAt = raw.publishedAt;
  if (typeof raw.measuredAt === 'string') node.measuredAt = raw.measuredAt;
  if (typeof raw.appliesTo === 'string') node.appliesTo = raw.appliesTo;
  if (typeof raw.obsStatus === 'string') node.obsStatus = raw.obsStatus;
  if (typeof raw.stake === 'string') node.stake = raw.stake;
  if (isRecord(raw.codeLists)) node.codeLists = deepClone(raw.codeLists);

  const prov = projectProv(raw.prov);
  if (prov) {
    for (const key of Object.keys(prov) as ProvRelationKey[]) {
      node[key] = prov[key];
    }
  }

  return node;
}

const OBSERVATION_ARRAY_KEYS = ['sources', 'hostSources'] as const;

function collectObservations(root: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;
    // Consensus / MCP / case-bank observation arrays (host-declared only)
    for (const key of OBSERVATION_ARRAY_KEYS) {
      const arr = node[key];
      if (!Array.isArray(arr)) continue;
      for (const [i, src] of arr.entries()) {
        if (isRecord(src)) {
          const obs = projectObservation(src, out.length + i);
          if (obs) out.push(obs);
        }
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if ((OBSERVATION_ARRAY_KEYS as readonly string[]).includes(k)) continue;
      if (isRecord(v) || Array.isArray(v)) visit(v);
    }
  };
  visit(root);
  return out;
}

/**
 * Build a JSON-LD projection from a receipt-like object.
 * Returns a **new** object; the input is never mutated (C1).
 */
export function projectReceiptToJsonLd(
  receipt: Record<string, unknown>,
): JsonLdProjection {
  // Touch a clone only for traversal so callers keep the original reference pristine.
  const snapshot = deepClone(receipt);
  const observations = collectObservations(snapshot);

  const projection: JsonLdProjection = {
    '@context': UVRN_RECEIPT_CONTEXT_IRI,
    '@type': 'uvrn:NetworkReceiptProjection',
    observations,
    omittedFields: [...DELIBERATELY_UNMAPPED_FIELDS],
  };

  if (typeof snapshot.schemaVersion === 'string') {
    projection.schemaVersion = snapshot.schemaVersion;
  }
  if (typeof snapshot.receiptHash === 'string') {
    projection.receiptHash = snapshot.receiptHash;
    projection.projectionOf = snapshot.receiptHash;
  }
  if (typeof snapshot.kind === 'string') projection.kind = snapshot.kind;
  if (snapshot.claim !== undefined) projection.claim = deepClone(snapshot.claim);
  if (typeof snapshot.source === 'string') projection.source = snapshot.source;
  if (typeof snapshot.action === 'string') projection.action = snapshot.action;
  if (typeof snapshot.occurredAt === 'string') {
    projection.occurredAt = snapshot.occurredAt;
  }
  if (snapshot.topic !== undefined) projection.topic = deepClone(snapshot.topic);
  if (snapshot.tags !== undefined) projection.tags = deepClone(snapshot.tags);
  if (typeof snapshot.narrative === 'string') {
    projection.narrative = snapshot.narrative;
  }

  return projection;
}
