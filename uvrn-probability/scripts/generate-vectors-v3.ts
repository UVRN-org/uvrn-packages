/**
 * Generates SPEC/vectors/probability-v3.json from tests/fixtures-v3.ts. Writes ONLY that file; never
 * touches probability-v1.json or probability-v2.json. Run deliberately
 * (pnpm --filter @uvrn/probability vectors:v3) — never to make a red test green.
 */

import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import { ForecastValidationError, computeQuestionHash, questionHashPreimage, runForecast } from '../src';
import { SPEC_KEYS } from '../tests/fixtures';
import { binaryQuestion } from '../tests/fixtures-v2';
import { validationErrorCasesV3, vectorCasesV3 } from '../tests/fixtures-v3';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const cases = vectorCasesV3().map((c) => {
  const result = runForecast(c.input, c.options);
  if (result.specVersion !== 'uvrn-probability-3') throw new Error(`${c.id}: expected a uvrn-probability-3 record`);
  const expected: Record<string, unknown> = {
    status: result.status,
    basis: result.basis,
    probabilities: result.probabilities,
    band: result.band,
    refusalCodes: result.refusals.map((r) => r.code),
    deadline: result.inputs.deadline,
    questionHash: result.questionHash,
    probabilityHash: result.probabilityHash,
    receiptHash: result.receipt.receiptHash,
    canonicalResultSha256: sha(canonicalize(result)),
  };
  if (result.receipt.signature) expected.signature = result.receipt.signature;
  const options = c.options?.signer
    ? { signer: { privateKey: '$keys.privateKeySeed', publicKeyRef: c.options.signer.publicKeyRef, signedAt: c.options.signer.signedAt } }
    : undefined;
  return { id: c.id, description: c.description, input: c.input, ...(options ? { options } : {}), expected };
});

const validationErrors = validationErrorCasesV3().map((c) => {
  try {
    runForecast(c.input as never);
  } catch (e) {
    const err = e as ForecastValidationError;
    if (!(err instanceof ForecastValidationError) || err.code !== c.error.code || err.path !== c.error.path) {
      throw new Error(`${c.id}: expected ${c.error.code} at ${c.error.path}`);
    }
    return { id: c.id, description: c.description, input: c.input, expectedError: { code: err.code, path: err.path } };
  }
  throw new Error(`${c.id}: expected a validation error`);
});

const q2 = { ...binaryQuestion('2026-10-31'), resolveByOffset: '-04:00' };
const q1 = binaryQuestion('2026-10-31');

const vectors = {
  spec: 'uvrn-probability-v3 §9 (golden vectors)',
  notes: [
    'Synthetic fixtures (example.org citations, invented questions). Not research; the World Series shape is a date/offset shape, not real odds.',
    'expected.canonicalResultSha256 = hex SHA-256 of JCS(runForecast(input, options)). Byte identity of the whole output.',
    'expected.deadline = the hashed inputs.deadline record (SPEC v3 §3.2).',
    'options.signer.privateKey "$keys.privateKeySeed" means: substitute keys.privateKeySeed (the SPEC test key from network-receipt.json).',
    'validationErrors: requests that MUST throw the typed validation error { code, path } and produce no receipt.',
    'SPEC/vectors/probability-v1.json and probability-v2.json are unchanged and still conformance-tested.',
    'Regenerate only deliberately with uvrn-probability/scripts/generate-vectors-v3.ts.',
  ],
  keys: SPEC_KEYS,
  cases,
  validationErrors,
  unit: {
    questionHashV2Identity: {
      note: 'uvrn-probability-question-2 = the question-1 preimage plus resolveByOffset, specVersion uvrn-probability-question-2. The same question without an offset keeps its question-1 hash.',
      question: q2,
      preimage: questionHashPreimage(q2),
      questionHash: computeQuestionHash(q2),
      questionWithoutOffset: q1,
      questionHashWithoutOffset: computeQuestionHash(q1),
    },
  },
};

if (vectors.unit.questionHashV2Identity.questionHash === vectors.unit.questionHashV2Identity.questionHashWithoutOffset) {
  throw new Error('question-2 identity must differ from question-1');
}

const out = join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v3.json');
writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`, 'utf8');
console.log(`wrote ${cases.length} cases and ${validationErrors.length} validation errors to ${out}`);
