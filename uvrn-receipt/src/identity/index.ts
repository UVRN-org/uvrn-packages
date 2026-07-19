/**
 * Cross-run claim identity per SPEC/uvrn-claim-id-v1.md.
 *
 * This identity is deliberately distinct from a producer's per-run `runClaimId`.
 * The normalized payload is serialized through the shared receipt canonicalizer
 * before hashing (ADR-006, ADR-010).
 */

import { createHash } from 'crypto';

import { canonicalize } from '../canonical';

const UNICODE_PUNCTUATION = /\p{P}+/gu;
const WHITESPACE = /\s+/gu;

/**
 * Normalize claim prose for cross-run identity.
 *
 * The operation is ordered and deterministic: Unicode NFKC, trim, Unicode-aware
 * lowercasing, punctuation-to-space, whitespace collapse, then a final trim.
 */
export function normalizeClaimText(claimText: string): string {
  if (typeof claimText !== 'string') {
    throw new TypeError('normalizeClaimText: claimText must be a string');
  }

  return claimText
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(UNICODE_PUNCTUATION, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

/** Normalize the optional identity domain with the same locked text rules. */
export function normalizeClaimDomain(domain?: string | null): string {
  if (domain === undefined || domain === null || domain === '') return '';
  if (typeof domain !== 'string') {
    throw new TypeError('normalizeClaimDomain: domain must be a string when supplied');
  }
  return normalizeClaimText(domain);
}

/**
 * Derive the additive cross-run identity `claim:<12 lowercase hex>`.
 *
 * This helper does not mutate or replace any existing receipt field or frozen
 * hash surface. Hosts may carry the result in an additive `canonicalClaimId`.
 */
export function canonicalClaimId(claimText: string, domain?: string | null): string {
  const normalizedClaimText = normalizeClaimText(claimText);
  if (normalizedClaimText.length === 0) {
    throw new TypeError('canonicalClaimId: claimText must contain non-punctuation text');
  }

  const payload = canonicalize({
    claimText: normalizedClaimText,
    domain: normalizeClaimDomain(domain),
  });
  const digest = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `claim:${digest.slice(0, 12)}`;
}
