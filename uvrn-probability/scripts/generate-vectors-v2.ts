/**
 * Generates SPEC/vectors/probability-v2.json from tests/fixtures-v2.ts. Never touches the legacy
 * probability-v1.json. Run deliberately (pnpm --filter @uvrn/probability vectors:v2) — never to
 * make a red test green.
 */

import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import {
  ForecastValidationError,
  computeOutcomeDeclarationHash,
  computeQuestionHash,
  runForecast,
  type ForecastInput,
} from '../src';
import { SPEC_KEYS } from '../tests/fixtures';
import { binaryQuestion, profileErrorCasesV2, vectorCasesV2, yesDeclaration } from '../tests/fixtures-v2';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const cases = vectorCasesV2().map((c) => {
  const result = runForecast(c.input, c.options);
  const expected: Record<string, unknown> = {
    status: result.status,
    basis: result.basis,
    probabilities: result.probabilities,
    band: result.band,
    refusalCodes: result.refusals.map((r) => r.code),
    questionHash: result.questionHash,
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

const validationErrors = profileErrorCasesV2().map((c) => {
  try {
    runForecast(c.input as ForecastInput);
  } catch (e) {
    const err = e as ForecastValidationError;
    if (!(err instanceof ForecastValidationError) || err.code !== c.error.code || err.path !== c.error.path) {
      throw new Error(`${c.id}: expected ${c.error.code} at ${c.error.path}`);
    }
    return { id: c.id, description: c.description, input: c.input, expectedError: { code: err.code, path: err.path } };
  }
  throw new Error(`${c.id}: expected a validation error`);
});

const composed = { ...binaryQuestion(), text: 'Will the caf\u00e9 fixture open?' };
const decomposed = { ...binaryQuestion(), text: '  Will the cafe\u0301 fixture open?\n' };
const nfcHash = computeQuestionHash(composed);
if (computeQuestionHash(decomposed) !== nfcHash) throw new Error('NFC unit vector mismatch');

const vectors = {
  spec: 'uvrn-probability-v2 §9 (golden vectors)',
  notes: [
    'Synthetic fixtures (example.org citations, invented questions). Not research; no real market, docket, or sports claim.',
    'expected.canonicalResultSha256 = hex SHA-256 of JCS(runForecast(input, options)). Byte identity of the whole output.',
    'options.signer.privateKey "$keys.privateKeySeed" means: substitute keys.privateKeySeed (the SPEC test key from network-receipt.json).',
    'validationErrors: malformed or policy-violating requests that MUST throw the typed validation error { code, path } and produce no receipt.',
    'The legacy SPEC/vectors/probability-v1.json is unchanged and still conformance-tested.',
    'Regenerate only deliberately with uvrn-probability/scripts/generate-vectors-v2.ts.',
  ],
  keys: SPEC_KEYS,
  cases,
  validationErrors,
  unit: {
    questionHashNfc: {
      note: 'NFC-equivalent text with outer whitespace yields one questionHash; inner whitespace and case are significant.',
      composed,
      decomposed,
      questionHash: nfcHash,
    },
    outcomeDeclaration: {
      note: 'uvrn-outcome-1 recompute over { specVersion, entryId, predictedOutcome, outcomeMetric, resolveBy, declaredAt }.',
      declaration: yesDeclaration(),
      outcomeHash: computeOutcomeDeclarationHash(yesDeclaration()),
    },
  },
};

const out = join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v2.json');
writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`, 'utf8');
console.log(`wrote ${cases.length} cases to ${out}`);
