/**
 * @uvrn/jsonld — leaf package: JSON-LD projection of UVRN receipts.
 *
 * Placement reasoning (recorded for BP-21 evidence):
 * - Lives as its own package so nothing in the hash/canonicalization path can
 *   import projection helpers (F7 / C2).
 * - Depends on `@uvrn/receipt` / `@uvrn/core` only as **dev** peers for tests;
 *   runtime projection is structural and does not call hashReceipt.
 * - No package depends on `@uvrn/jsonld` → workspace cycle count stays zero.
 */

export {
  UVRN_RECEIPT_CONTEXT_IRI,
  UVRN_RECEIPT_FRAME,
  PROV_RELATION_KEYS,
  loadUvrnReceiptContextDocument,
} from './context';
export type { ProvRelationKey } from './context';

export {
  projectReceiptToJsonLd,
  DELIBERATELY_UNMAPPED_FIELDS,
} from './project';
export type { JsonLdProjection } from './project';

export {
  OFFLINE_LINKED_DATA_VALIDATOR,
  offlineDocumentLoader,
  expandOffline,
  frameOffline,
} from './validate';
