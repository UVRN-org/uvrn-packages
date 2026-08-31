/**
 * Committed local JSON-LD context + frame for UVRN receipt projection.
 * Resolved only via the offline documentLoader — never fetched at runtime.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Stable IRI for the in-repo context document (offline-resolved only). */
export const UVRN_RECEIPT_CONTEXT_IRI =
  'https://uvrn.org/context/receipt-v1.jsonld';

const CONTEXT_PATH = join(
  dirname(__dirname),
  'context',
  'uvrn-receipt-context-v1.jsonld',
);

let cachedContextDoc: Record<string, unknown> | undefined;

/** Load the committed `@context` document from disk (offline). */
export function loadUvrnReceiptContextDocument(): Record<string, unknown> {
  if (!cachedContextDoc) {
    cachedContextDoc = JSON.parse(readFileSync(CONTEXT_PATH, 'utf8')) as Record<
      string,
      unknown
    >;
  }
  return cachedContextDoc;
}

/** Compact framing definition for projected NetworkReceipt graphs. */
export const UVRN_RECEIPT_FRAME: Record<string, unknown> = {
  '@context': UVRN_RECEIPT_CONTEXT_IRI,
  '@type': 'uvrn:NetworkReceiptProjection',
  observations: {
    '@type': 'uvrn:TypedObservation',
    '@explicit': true,
  },
};

/** Host-declared PROV relation keys that may be projected (never inferred). */
export const PROV_RELATION_KEYS = [
  'wasDerivedFrom',
  'hadPrimarySource',
  'wasQuotedFrom',
  'wasRevisionOf',
  'wasAttributedTo',
] as const;

export type ProvRelationKey = (typeof PROV_RELATION_KEYS)[number];
