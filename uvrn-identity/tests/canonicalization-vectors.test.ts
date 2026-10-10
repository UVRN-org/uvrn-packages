/**
 * WS-CANON-UNIFY Phase 0 — shared canonicalization conformance vectors (ADR-006).
 *
 * Phase B proves identity imports core's one live canonical-serialize-2 implementation and meets
 * every strict expectation, including the shared sparse-hole → JSON null policy.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalSerializeV2 } from '@uvrn/core/canonical-serialize-2';
import { canonicalize } from '../src/registry/attestation';

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

describe('SPEC/canonicalization-vectors.json — identity shared canonical-serialize-2', () => {
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

  it('uses the shared core function directly (no live hand copy)', () => {
    expect(canonicalize).toBe(canonicalSerializeV2);
  });
});
