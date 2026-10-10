/**
 * Regenerates SPEC/vectors/probability-v1.json from tests/fixtures.ts.
 * Run deliberately (pnpm --filter @uvrn/probability vectors) — never to make a red test green.
 */

import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import { runProbability, round6 } from '../src';
import { impliedProbability } from '../src/odds';
import { jeffreysInterval, conditionalCumulativeIncidence, oneMinusKaplanMeier } from '../src/baserate';
import { SPEC_KEYS, TTE_EVENTS, vectorCases } from '../tests/fixtures';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const cases = vectorCases().map((c) => {
  const result = runProbability(c.input, c.options);
  const expected: Record<string, unknown> = {
    method: result.method,
    p: result.p,
    low: result.low,
    high: result.high,
    refusalCodes: result.refusals.map((r) => r.code),
    probabilityHash: result.probabilityHash,
    receiptHash: result.receipt.receiptHash,
    canonicalResultSha256: sha(canonicalize(result)),
  };
  if (result.receipt.signature) expected.signature = result.receipt.signature;
  const options = c.options?.signer
    ? {
        signer: {
          privateKey: '$keys.privateKeySeed',
          publicKeyRef: c.options.signer.publicKeyRef,
          signedAt: c.options.signer.signedAt,
        },
      }
    : undefined;
  return { id: c.id, description: c.description, input: c.input, ...(options ? { options } : {}), expected };
});

const observations = TTE_EVENTS.map(([time, status]) => ({
  time,
  type: (status === 'approved' ? 1 : status === 'pending' ? 0 : 2) as 0 | 1 | 2,
}));

const vectors = {
  spec: 'uvrn-probability-v1 §8 (golden vectors)',
  notes: [
    'Synthetic fixtures (example.org citations). Not research; no real market or docket data.',
    'expected.canonicalResultSha256 = hex SHA-256 of JCS(runProbability(input, options)). Byte identity of the whole output.',
    'options.signer.privateKey "$keys.privateKeySeed" means: substitute keys.privateKeySeed (the SPEC test key from network-receipt.json).',
    'Regenerate only deliberately with uvrn-probability/scripts/generate-vectors.ts.',
  ],
  keys: SPEC_KEYS,
  cases,
  unit: {
    impliedProbability: [
      { odds: { format: 'american', value: -150 }, expected: 0.6 },
      { odds: { format: 'american', value: 130 }, expected: round6(100 / 230) },
      { odds: { format: 'american', value: 100 }, expected: 0.5 },
      { odds: { format: 'decimal', value: 2.5 }, expected: 0.4 },
      { odds: { format: 'fractional', numerator: 3, denominator: 2 }, expected: 0.4 },
      { odds: { format: 'american', value: 99 }, expected: null },
      { odds: { format: 'decimal', value: 1 }, expected: null },
    ].map((v) => {
      const got = impliedProbability(v.odds as never);
      if ((got === null ? null : round6(got)) !== v.expected) throw new Error(`implied mismatch ${JSON.stringify(v)}`);
      return v;
    }),
    jeffreys: [
      [0, 10],
      [5, 10],
      [10, 10],
      [3, 8],
      [1, 20],
    ].map(([x, n]) => {
      const j = jeffreysInterval(x, n);
      return { x, n, p: round6(j.p), low: round6(j.low), high: round6(j.high) };
    }),
    aalenJohansenVsNaiveKm: {
      note: 'Competing events treated as censored (1 − KM) overstate the approval probability.',
      events: TTE_EVENTS.map(([time, status]) => ({ time, status })),
      horizonDays: 450,
      aalenJohansen: round6(conditionalCumulativeIncidence(observations, 0, 450).estimate),
      naiveOneMinusKaplanMeier: round6(oneMinusKaplanMeier(observations, 450)),
    },
  },
};

const out = join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v1.json');
writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`, 'utf8');
console.log(`wrote ${cases.length} cases to ${out}`);
