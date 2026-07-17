/**
 * WS-CANON-UNIFY Phase 0 — shared canonicalization conformance vectors (ADR-006).
 *
 * Runs core's `canonicalSerialize` against SPEC/canonicalization-vectors.json. Vectors with a
 * `knownDivergence.core` entry pin CURRENT lenient behavior (malformed undefined-member output,
 * silent NaN→null, '[1,,2]' elision, '' for top-level undefined) as characterization assertions —
 * pinned, not skipped, not fixed. Unpinning is a Phase B behavior change with its own
 * golden-hash regression proof (ADR-010). Do not edit src/ to make these green.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalSerialize } from '../src/core/serialization';

const IMPL = 'core';

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

describe('SPEC/canonicalization-vectors.json — core canonicalSerialize', () => {
  for (const vector of vectors) {
    const pin = vector.knownDivergence?.[IMPL];

    if (pin) {
      it(`[KNOWN DIVERGENCE — pinned] ${vector.id}`, () => {
        // Stale-pin guard: a pin identical to the strict expectation must be deleted.
        expect(pin.canonical).not.toBe(vector.expect.canonical);
        expect(canonicalSerialize(hydrate(vector.input))).toBe(pin.canonical);
      });
    } else if (vector.expect.error) {
      it(`${vector.id} → throws`, () => {
        expect(() => canonicalSerialize(hydrate(vector.input))).toThrow();
      });
    } else {
      it(`${vector.id} → ${vector.expect.canonical}`, () => {
        expect(canonicalSerialize(hydrate(vector.input))).toBe(vector.expect.canonical);
      });
    }
  }

  it('enumerates the core divergence set (audit §2 P1 characterization baseline)', () => {
    const pinnedIds = vectors.filter((v) => v.knownDivergence?.[IMPL]).map((v) => v.id).sort();
    expect(pinnedIds).toEqual([
      'infinity-top-level',
      'nan-in-array',
      'nan-object-member',
      'nan-top-level',
      'negative-infinity-top-level',
      'sparse-array-hole',
      'undefined-array-element',
      'undefined-object-member',
      'undefined-top-level',
    ]);
  });
});
