/**
 * WS-CANON-UNIFY Phase 0 — shared canonicalization conformance vectors (ADR-006).
 *
 * Phase B runs receipt's delegated canonical-serialize-2 path against every strict expectation.
 * Historical pins remain in the vector file as characterization evidence, but no longer apply to
 * this live v2 consumer.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize, canonicalSerializeV2 } from '../src/canonical';

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

describe('SPEC/canonicalization-vectors.json — receipt canonicalize', () => {
  for (const vector of vectors) {
    if (vector.expect.error) {
      it(`${vector.id} → throws`, () => {
        expect(() => canonicalize(hydrate(vector.input))).toThrow(TypeError);
      });
    } else {
      it(`${vector.id} → ${vector.expect.canonical}`, () => {
        expect(canonicalize(hydrate(vector.input))).toBe(vector.expect.canonical);
      });
    }
  }

  it('delegates to the shared core v2 function', () => {
    expect(canonicalize).not.toBe(canonicalSerializeV2);
    const sparse = [1, 2, 3];
    delete sparse[1];
    expect(canonicalize(sparse)).toBe('[1,null,3]');
    expect(canonicalize(sparse)).toBe(canonicalSerializeV2(sparse));
  });
});
