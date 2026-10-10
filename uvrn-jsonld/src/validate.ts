/**
 * Offline linked-data validation via jsonld.js expand + local documentLoader.
 *
 * Named validator (Admin note / F8):
 *   jsonld.js — npm package `jsonld` (Digital Bazaar JSON-LD Processor)
 *   API: jsonld.expand(document, { documentLoader })
 *   documentLoader serves only the committed UVRN context IRI; all other URLs refuse.
 */

import jsonld from 'jsonld';
import {
  loadUvrnReceiptContextDocument,
  UVRN_RECEIPT_CONTEXT_IRI,
  UVRN_RECEIPT_FRAME,
} from './context';

export const OFFLINE_LINKED_DATA_VALIDATOR = {
  name: 'jsonld.js',
  package: 'jsonld',
  api: 'expand',
  mode: 'offline-documentLoader',
  contextIri: UVRN_RECEIPT_CONTEXT_IRI,
} as const;

/**
 * Offline documentLoader: resolves the committed UVRN context only.
 * Any other URL (including remote http/https contexts) throws — no network fetch.
 */
export async function offlineDocumentLoader(url: string): Promise<{
  contextUrl: null;
  document: unknown;
  documentUrl: string;
}> {
  if (url === UVRN_RECEIPT_CONTEXT_IRI) {
    return {
      contextUrl: null,
      document: loadUvrnReceiptContextDocument(),
      documentUrl: url,
    };
  }
  throw new Error(
    `offline documentLoader refused URL (no remote fetch): ${url}`,
  );
}

/** Expand a projected document with the named offline validator. */
export async function expandOffline(
  document: Record<string, unknown>,
): Promise<unknown[]> {
  return (await jsonld.expand(document, {
    documentLoader: offlineDocumentLoader,
  })) as unknown[];
}

/** Frame a projected document offline (optional consumer path). */
export async function frameOffline(
  document: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await jsonld.frame(document, UVRN_RECEIPT_FRAME, {
    documentLoader: offlineDocumentLoader,
  })) as Record<string, unknown>;
}
