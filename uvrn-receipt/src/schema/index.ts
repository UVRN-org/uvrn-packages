/**
 * NetworkReceipt validation per SPEC/uvrn-receipt-v1.md §3.
 * Exports a standard JSON Schema document (for ajv users such as the worker) plus a dependency-free
 * structural validator, preserving the zero-external path.
 */

import { RECEIPT_HASH_PATTERN } from '../canonical';
import type { NetworkReceipt } from '../types';

export const RECEIPT_KINDS = [
  'delta',
  'master',
  'drift',
  'canon',
  'parity',
  'analytics',
  'genesis',
] as const;

export const LINK_RELS = ['follows', 'caused-by', 'references', 'part-of', 'responds-to'] as const;

/** JSON Schema (draft 2020-12) for the `uvrn-receipt-4` envelope. */
export const NETWORK_RECEIPT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://uvrn.org/schemas/uvrn-receipt-4.json',
  type: 'object',
  required: ['schemaVersion', 'receiptHash', 'kind', 'claim', 'source', 'action', 'occurredAt', 'payload'],
  properties: {
    schemaVersion: { const: 'uvrn-receipt-4' },
    receiptHash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    kind: { type: 'string', minLength: 1 },
    claim: {
      type: 'object',
      required: ['id', 'text'],
      properties: {
        id: { type: 'string', minLength: 1 },
        text: { type: 'string', minLength: 1 },
      },
    },
    source: { type: 'string', minLength: 1 },
    action: { type: 'string', minLength: 1 },
    occurredAt: { type: 'string', format: 'date-time' },
    payload: { type: 'object' },
    topic: { type: 'string', minLength: 1 },
    tags: { type: 'array', items: { type: 'string' } },
    narrative: { type: 'string', maxLength: 500 },
    links: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        required: ['hash', 'rel'],
        properties: {
          hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
          rel: { enum: [...LINK_RELS] },
          label: { type: 'string', maxLength: 256 },
        },
      },
    },
    chainId: { type: 'string', maxLength: 128 },
    sdk: {
      type: 'object',
      required: ['name', 'version', 'integrityHash'],
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        integrityHash: { type: 'string' },
      },
    },
    signature: {
      type: 'object',
      required: ['alg', 'publicKeyRef', 'sig'],
      properties: {
        alg: { const: 'ed25519' },
        publicKeyRef: { type: 'string', minLength: 1 },
        sig: { type: 'string', minLength: 1 },
        signedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  allOf: [
    {
      if: { properties: { kind: { const: 'master' } } },
      then: { required: ['narrative'], properties: { narrative: { type: 'string', minLength: 1 } } },
    },
  ],
} as const;

/** ValidationOutcome lists every problem found; valid means zero problems. */
export interface ValidationOutcome {
  valid: boolean;
  errors: string[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isIsoDate(value: unknown): boolean {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * validateNetworkReceipt structurally validates a candidate envelope without external deps.
 * It mirrors NETWORK_RECEIPT_SCHEMA; consumers ignore unknown fields (forward compatibility).
 */
export function validateNetworkReceipt(candidate: unknown): ValidationOutcome {
  const errors: string[] = [];
  if (!isPlainObject(candidate)) {
    return { valid: false, errors: ['receipt must be an object'] };
  }
  const r = candidate as Partial<NetworkReceipt> & Record<string, unknown>;

  if (r.schemaVersion !== 'uvrn-receipt-4') errors.push('schemaVersion must be "uvrn-receipt-4"');
  if (typeof r.receiptHash !== 'string' || !RECEIPT_HASH_PATTERN.test(r.receiptHash)) {
    errors.push('receiptHash must match sha256:<64 lowercase hex>');
  }
  if (typeof r.kind !== 'string' || r.kind.length === 0) errors.push('kind must be a non-empty string');
  if (!isPlainObject(r.claim) || typeof r.claim.id !== 'string' || r.claim.id.length === 0 ||
      typeof r.claim.text !== 'string' || r.claim.text.length === 0) {
    errors.push('claim must be { id, text } with non-empty strings');
  }
  for (const field of ['source', 'action'] as const) {
    if (typeof r[field] !== 'string' || (r[field] as string).length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (!isIsoDate(r.occurredAt)) errors.push('occurredAt must be a valid ISO 8601 date-time');
  if (!isPlainObject(r.payload)) errors.push('payload must be an object');

  if (r.topic !== undefined && (typeof r.topic !== 'string' || r.topic.length === 0)) {
    errors.push('topic must be a non-empty string when present');
  }
  if (r.tags !== undefined && (!Array.isArray(r.tags) || r.tags.some((t) => typeof t !== 'string'))) {
    errors.push('tags must be an array of strings when present');
  }
  if (r.narrative !== undefined && (typeof r.narrative !== 'string' || r.narrative.length > 500)) {
    errors.push('narrative must be a string of at most 500 characters');
  }
  if (r.kind === 'master' && (typeof r.narrative !== 'string' || r.narrative.length === 0)) {
    errors.push('narrative is required for kind "master"');
  }
  if (r.links !== undefined) {
    if (!Array.isArray(r.links) || r.links.length > 50) {
      errors.push('links must be an array of at most 50 entries');
    } else {
      r.links.forEach((link, index) => {
        if (!isPlainObject(link)) {
          errors.push(`links[${index}] must be an object`);
          return;
        }
        if (typeof link.hash !== 'string' || !RECEIPT_HASH_PATTERN.test(link.hash)) {
          errors.push(`links[${index}].hash must match sha256:<64 lowercase hex>`);
        }
        if (!(LINK_RELS as readonly string[]).includes(link.rel as string)) {
          errors.push(`links[${index}].rel must be one of ${LINK_RELS.join(', ')}`);
        }
        if (link.label !== undefined && (typeof link.label !== 'string' || link.label.length > 256)) {
          errors.push(`links[${index}].label must be a string of at most 256 characters`);
        }
      });
    }
  }
  if (r.chainId !== undefined && (typeof r.chainId !== 'string' || r.chainId.length > 128)) {
    errors.push('chainId must be a string of at most 128 characters');
  }
  if (r.sdk !== undefined) {
    if (!isPlainObject(r.sdk) || typeof r.sdk.name !== 'string' || typeof r.sdk.version !== 'string' ||
        typeof r.sdk.integrityHash !== 'string') {
      errors.push('sdk must be { name, version, integrityHash } when present');
    }
  }
  if (r.signature !== undefined) {
    const sig = r.signature as unknown as Record<string, unknown>;
    if (!isPlainObject(sig) || sig.alg !== 'ed25519' || typeof sig.publicKeyRef !== 'string' ||
        sig.publicKeyRef.length === 0 || typeof sig.sig !== 'string' || sig.sig.length === 0) {
      errors.push('signature must be { alg: "ed25519", publicKeyRef, sig } when present');
    } else if (sig.signedAt !== undefined && !isIsoDate(sig.signedAt)) {
      errors.push('signature.signedAt must be a valid ISO 8601 date-time when present');
    }
  }

  return { valid: errors.length === 0, errors };
}
