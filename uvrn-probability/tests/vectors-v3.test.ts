/**
 * Golden-vector conformance for SPEC/vectors/probability-v3.json (SPEC/uvrn-probability-v3.md §9).
 * If these fail, either the implementation or the spec moved. Regenerate only deliberately.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import {
  ForecastValidationError,
  computeQuestionHash,
  questionHashPreimage,
  runForecast,
  verifyForecastReceipt,
  type ForecastInputV3,
  type ForecastOptions,
} from '../src';

const vectors = JSON.parse(readFileSync(join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v3.json'), 'utf8'));
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function resolveOptions(options: { signer?: Record<string, string> } | undefined): ForecastOptions | undefined {
  if (!options?.signer) return undefined;
  return { signer: { privateKey: vectors.keys.privateKeySeed, publicKeyRef: options.signer.publicKeyRef, signedAt: options.signer.signedAt } };
}

describe('SPEC/vectors/probability-v3.json', () => {
  it('covers the required scenarios', () => {
    const ids = vectors.cases.map((c: { id: string }) => c.id);
    for (const required of [
      'v3-market-offset-match',
      'v3-market-offset-mismatch',
      'v3-market-mismatch-local-differs',
      'v3-baserate-mismatch-local-differs',
      'v3-market-date-only-local-end',
      'v3-market-offset-plus-0530',
      'v3-market-offset-plus-0545',
      'v3-market-utc-offset',
      'v3-judgment-offset-minus-1200',
      'v3-judgment-offset-plus-1400',
      'v3-judgment-categorical',
      'v3-judgment-abstain',
      'v3-baserate-horizon-local-end',
      'v3-baserate-mixed-date-reading',
      'v3-baserate-proportion',
      'v3-profile-tightened-refusal',
      'v3-market-signed',
    ]) {
      expect(ids).toContain(required);
    }
    const errors = vectors.validationErrors.map((c: { id: string }) => c.id);
    for (const required of [
      'v3-missing-offset',
      'v3-offset-minus-zero',
      'v3-offset-minus-1201',
      'v3-offset-plus-1401',
      'v3-offset-plus-2400',
      'v3-asof-at-deadline-end',
      'v3-year-range-upper',
      'v3-year-range-upper-exact',
      'v3-year-range-lower',
      'v3-cutoff-year-range',
      'v3-horizon-year-range',
    ]) {
      expect(errors).toContain(required);
    }
  });

  const table: Array<[string, unknown]> = vectors.cases.map((c: { id: string }) => [c.id, c]);
  it.each(table)('%s reproduces byte-identically', (_id, c) => {
    const vector = c as { input: ForecastInputV3; options?: { signer?: Record<string, string> }; expected: Record<string, unknown> };
    const result = runForecast(vector.input, resolveOptions(vector.options));
    expect(result.specVersion).toBe('uvrn-probability-3');
    expect(result.status).toBe(vector.expected.status);
    expect(result.basis).toBe(vector.expected.basis);
    expect(result.probabilities).toEqual(vector.expected.probabilities);
    expect(result.band).toEqual(vector.expected.band);
    expect(result.refusals.map((r) => r.code)).toEqual(vector.expected.refusalCodes);
    expect(result.specVersion === 'uvrn-probability-3' && result.inputs.deadline).toEqual(vector.expected.deadline);
    expect(result.questionHash).toBe(vector.expected.questionHash);
    expect(result.probabilityHash).toBe(vector.expected.probabilityHash);
    expect(result.receipt.receiptHash).toBe(vector.expected.receiptHash);
    expect(sha(canonicalize(result))).toBe(vector.expected.canonicalResultSha256);
    if (vector.expected.signature) {
      expect(result.receipt.signature).toEqual(vector.expected.signature);
      expect(verifyForecastReceipt(result.receipt, { publicKey: vectors.keys.publicKey }).verified).toBe(true);
    }
  });

  const errors: Array<[string, unknown]> = vectors.validationErrors.map((c: { id: string }) => [c.id, c]);
  it.each(errors)('%s throws the pinned validation error', (_id, c) => {
    const v = c as { input: unknown; expectedError: { code: string; path: string } };
    let caught: unknown;
    try {
      runForecast(v.input as never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForecastValidationError);
    expect({ code: (caught as ForecastValidationError).code, path: (caught as ForecastValidationError).path }).toEqual(v.expectedError);
  });

  it('unit: the uvrn-probability-question-2 preimage and hash', () => {
    const u = vectors.unit.questionHashV2Identity;
    expect(questionHashPreimage(u.question)).toEqual(u.preimage);
    expect(computeQuestionHash(u.question)).toBe(u.questionHash);
    expect(computeQuestionHash(u.questionWithoutOffset)).toBe(u.questionHashWithoutOffset);
    expect(u.preimage.specVersion).toBe('uvrn-probability-question-2');
  });
});
