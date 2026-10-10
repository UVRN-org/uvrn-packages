/**
 * Golden-vector conformance for SPEC/vectors/probability-v1.json (SPEC/uvrn-probability-v1.md §8).
 * If these fail, either the implementation or the spec moved. Regenerate only deliberately.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import { round6, runProbability, verifyProbabilityReceipt, type ProbabilityRunInput, type RunOptions } from '../src';
import { impliedProbability } from '../src/odds';
import { conditionalCumulativeIncidence, jeffreysInterval, oneMinusKaplanMeier } from '../src/baserate';

const vectors = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v1.json'), 'utf8')
);

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function resolveOptions(options: { signer?: Record<string, string> } | undefined): RunOptions | undefined {
  if (!options?.signer) return undefined;
  return {
    signer: {
      privateKey: vectors.keys.privateKeySeed,
      publicKeyRef: options.signer.publicKeyRef,
      signedAt: options.signer.signedAt,
    },
  };
}

describe('SPEC/vectors/probability-v1.json', () => {
  it('covers the required scenarios', () => {
    const ids = vectors.cases.map((c: { id: string }) => c.id);
    for (const required of [
      'sportsbook-two-way',
      'sportsbook-multi-outcome',
      'exchange-binary',
      'market-stale-refusal',
      'baserate-small-n',
      'baserate-x-zero',
      'baserate-x-equals-n',
      'baserate-censored-competing',
      'baserate-conditional',
      'baserate-below-min-cases',
    ]) {
      expect(ids).toContain(required);
    }
  });

  const table: Array<[string, unknown]> = vectors.cases.map((c: { id: string }) => [c.id, c]);
  it.each(table)('%s reproduces byte-identically', (_id, c) => {
    const vector = c as {
      input: ProbabilityRunInput;
      options?: { signer?: Record<string, string> };
      expected: Record<string, unknown>;
    };
    const result = runProbability(vector.input, resolveOptions(vector.options));
    expect(result.method).toBe(vector.expected.method);
    expect(result.p).toBe(vector.expected.p);
    expect(result.low).toBe(vector.expected.low);
    expect(result.high).toBe(vector.expected.high);
    expect(result.refusals.map((r) => r.code)).toEqual(vector.expected.refusalCodes);
    expect(result.probabilityHash).toBe(vector.expected.probabilityHash);
    expect(result.receipt.receiptHash).toBe(vector.expected.receiptHash);
    expect(sha(canonicalize(result))).toBe(vector.expected.canonicalResultSha256);
    if (vector.expected.signature) {
      expect(result.receipt.signature).toEqual(vector.expected.signature);
      expect(verifyProbabilityReceipt(result.receipt, { publicKey: vectors.keys.publicKey }).verified).toBe(true);
    }
  });

  it('unit vectors: implied probability', () => {
    for (const v of vectors.unit.impliedProbability) {
      const got = impliedProbability(v.odds);
      expect(got === null ? null : round6(got)).toBe(v.expected);
    }
  });

  it('unit vectors: Jeffreys', () => {
    for (const v of vectors.unit.jeffreys) {
      const j = jeffreysInterval(v.x, v.n);
      expect([round6(j.p), round6(j.low), round6(j.high)]).toEqual([v.p, v.low, v.high]);
    }
  });

  it('unit vectors: naive 1 − KM overstates Aalen-Johansen', () => {
    const v = vectors.unit.aalenJohansenVsNaiveKm;
    const obs = v.events.map((e: { time: number; status: string }) => ({
      time: e.time,
      type: e.status === 'approved' ? 1 : e.status === 'pending' ? 0 : 2,
    }));
    expect(round6(conditionalCumulativeIncidence(obs, 0, v.horizonDays).estimate)).toBe(v.aalenJohansen);
    expect(round6(oneMinusKaplanMeier(obs, v.horizonDays))).toBe(v.naiveOneMinusKaplanMeier);
    expect(v.naiveOneMinusKaplanMeier).toBeGreaterThan(v.aalenJohansen);
  });
});
