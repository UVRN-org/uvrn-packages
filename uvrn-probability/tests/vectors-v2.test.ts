/**
 * Golden-vector conformance for SPEC/vectors/probability-v2.json (SPEC/uvrn-probability-v2.md §9).
 * If these fail, either the implementation or the spec moved. Regenerate only deliberately.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';
import {
  ForecastValidationError,
  computeOutcomeDeclarationHash,
  computeQuestionHash,
  runForecast,
  verifyForecastReceipt,
  type ForecastInput,
  type ForecastOptions,
} from '../src';

const vectors = JSON.parse(readFileSync(join(__dirname, '..', '..', 'SPEC', 'vectors', 'probability-v2.json'), 'utf8'));
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function resolveOptions(options: { signer?: Record<string, string> } | undefined): ForecastOptions | undefined {
  if (!options?.signer) return undefined;
  return {
    signer: { privateKey: vectors.keys.privateKeySeed, publicKeyRef: options.signer.publicKeyRef, signedAt: options.signer.signedAt },
  };
}

describe('SPEC/vectors/probability-v2.json', () => {
  it('covers the required scenarios', () => {
    const ids = vectors.cases.map((c: { id: string }) => c.id);
    for (const required of [
      'v2-market-sportsbook',
      'v2-market-exchange-settles-later',
      'v2-market-deadline-mismatch',
      'v2-baserate-proportion',
      'v2-baserate-competing',
      'v2-baserate-at-risk-boundary-accepted',
      'v2-baserate-at-risk-boundary-refused',
      'v2-baserate-interval-unavailable',
      'v2-baserate-deadline-date-only',
      'v2-baserate-deadline-zoned',
      'v2-market-cutoff-same-day-date-only',
      'v2-market-cutoff-same-day-zoned',
      'v2-judgment-binary',
      'v2-judgment-categorical',
      'v2-judgment-assumption-only',
      'v2-judgment-abstain',
      'v2-judgment-declaration-revision-signed',
    ]) {
      expect(ids).toContain(required);
    }
  });

  const table: Array<[string, unknown]> = vectors.cases.map((c: { id: string }) => [c.id, c]);
  it.each(table)('%s reproduces byte-identically', (_id, c) => {
    const vector = c as { input: ForecastInput; options?: { signer?: Record<string, string> }; expected: Record<string, unknown> };
    const result = runForecast(vector.input, resolveOptions(vector.options));
    expect(result.status).toBe(vector.expected.status);
    expect(result.basis).toBe(vector.expected.basis);
    expect(result.probabilities).toEqual(vector.expected.probabilities);
    expect(result.band).toEqual(vector.expected.band);
    expect(result.refusals.map((r) => r.code)).toEqual(vector.expected.refusalCodes);
    expect(result.questionHash).toBe(vector.expected.questionHash);
    expect(result.probabilityHash).toBe(vector.expected.probabilityHash);
    expect(result.receipt.receiptHash).toBe(vector.expected.receiptHash);
    expect(sha(canonicalize(result))).toBe(vector.expected.canonicalResultSha256);
    if (vector.expected.signature) {
      expect(result.receipt.signature).toEqual(vector.expected.signature);
      expect(verifyForecastReceipt(result.receipt, { publicKey: vectors.keys.publicKey }).verified).toBe(true);
    }
  });

  it('covers the rule-profile validation-error scenarios', () => {
    const ids = vectors.validationErrors.map((c: { id: string }) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'v2-profile-mode-not-allowed',
        'v2-profile-unknown-field',
        'v2-profile-loosening-rejected',
        'v2-profile-requirement-unmet',
      ])
    );
    expect(vectors.cases.map((c: { id: string }) => c.id)).toEqual(
      expect.arrayContaining(['v2-profile-min-cases-refusal', 'v2-profile-judgment-accepted'])
    );
  });

  const errorTable: Array<[string, unknown]> = vectors.validationErrors.map((c: { id: string }) => [c.id, c]);
  it.each(errorTable)('%s throws its typed validation error and produces no receipt', (_id, c) => {
    const vector = c as { input: ForecastInput; expectedError: { code: string; path: string } };
    let caught: unknown;
    let result: unknown;
    try {
      result = runForecast(vector.input);
    } catch (e) {
      caught = e;
    }
    expect(result).toBeUndefined();
    expect(caught).toBeInstanceOf(ForecastValidationError);
    expect((caught as ForecastValidationError).code).toBe(vector.expectedError.code);
    expect((caught as ForecastValidationError).path).toBe(vector.expectedError.path);
  });

  it('unit vectors: NFC question hash and outcome-declaration hash', () => {
    const u = vectors.unit;
    expect(computeQuestionHash(u.questionHashNfc.composed)).toBe(u.questionHashNfc.questionHash);
    expect(computeQuestionHash(u.questionHashNfc.decomposed)).toBe(u.questionHashNfc.questionHash);
    expect(computeOutcomeDeclarationHash(u.outcomeDeclaration.declaration)).toBe(u.outcomeDeclaration.outcomeHash);
    expect(u.outcomeDeclaration.declaration.outcomeHash).toBe(u.outcomeDeclaration.outcomeHash);
  });
});
