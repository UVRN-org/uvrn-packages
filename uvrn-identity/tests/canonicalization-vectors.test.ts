/**
 * WS-CANON-UNIFY Phase 0 — shared canonicalization conformance vectors (ADR-006).
 *
 * Runs identity's local JCS `canonicalize` (the deliberate zero-dep hand copy of receipt's
 * serializer in src/registry/attestation.ts) against SPEC/canonicalization-vectors.json. This
 * suite is what enforces the "byte-identical by convention" promise going forward: identity must
 * meet the strict outcomes except where a `knownDivergence.identity` pin exists — per Decision-1
 * evidence (2026-07-16) that is exactly the true-sparse-array case, shared by all three
 * implementations ('[1,,2]'). Imported from the module path on purpose; the public package
 * index is NOT expanded (ADR-010).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '../src/registry/attestation';

const IMPL = 'identity';

interface DivergencePin {
  canonical: string;
  note?: string;
}

interface Vector {
  id: string;
  description: string;
  input: unknown;
  expect: { canonical?: string; error?: boolean };
  knownDivergence?: Record<string, DivergencePin>;
}

const VECTORS_PATH = join(__dirname, '..', '..', 'SPEC', 'canonicalization-vectors.json');
const { vectors } = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as { vectors: Vector[] };

const TOKEN_KEY = '$uvrn';
type TokenName = 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | 'sparseHole';

function isToken(value: unknown): value is { $uvrn: TokenName } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>)[TOKEN_KEY] === 'string'
  );
}

/** hydrate replaces $uvrn tokens with real JS values; sparseHole becomes a true array hole. */
function hydrate(value: unknown): unknown {
  if (isToken(value)) {
    switch (value.$uvrn) {
      case 'undefined':
        return undefined;
      case 'NaN':
        return Number.NaN;
      case 'Infinity':
        return Number.POSITIVE_INFINITY;
      case '-Infinity':
        return Number.NEGATIVE_INFINITY;
      case 'sparseHole':
        throw new Error('sparseHole token is only valid inside an array');
      default:
        throw new Error(`unknown $uvrn token: ${String(value.$uvrn)}`);
    }
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    out.length = value.length;
    value.forEach((item, i) => {
      if (isToken(item) && item.$uvrn === 'sparseHole') {
        return; // leave a true hole at index i
      }
      out[i] = hydrate(item);
    });
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
      out[key] = hydrate(member);
    }
    return out;
  }
  return value;
}

describe('SPEC/canonicalization-vectors.json — identity canonicalize (local copy)', () => {
  for (const vector of vectors) {
    const pin = vector.knownDivergence?.[IMPL];

    if (pin) {
      it(`[KNOWN DIVERGENCE — pinned] ${vector.id}`, () => {
        // Stale-pin guard: a pin identical to the strict expectation must be deleted.
        expect(pin.canonical).not.toBe(vector.expect.canonical);
        expect(canonicalize(hydrate(vector.input))).toBe(pin.canonical);
      });
    } else if (vector.expect.error) {
      it(`${vector.id} → throws`, () => {
        expect(() => canonicalize(hydrate(vector.input))).toThrow(TypeError);
      });
    } else {
      it(`${vector.id} → ${vector.expect.canonical}`, () => {
        expect(canonicalize(hydrate(vector.input))).toBe(vector.expect.canonical);
      });
    }
  }

  it('enumerates the identity divergence set (sparse hole only, per Decision-1 evidence)', () => {
    const pinnedIds = vectors.filter((v) => v.knownDivergence?.[IMPL]).map((v) => v.id).sort();
    expect(pinnedIds).toEqual(['sparse-array-hole']);
  });
});
