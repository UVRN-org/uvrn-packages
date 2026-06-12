/**
 * Golden-vector conformance per SPEC/uvrn-receipt-v1.md §6. The fixtures in SPEC/vectors/ are
 * the cross-implementation contract; if these fail, either the implementation or the spec moved.
 * Regenerate deliberately with scripts/generate-vectors.js — never to make a red test green.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { verifyMasterReceipt } from '@uvrn/core';
import {
  canonicalize,
  computeNetworkReceiptHash,
  toHumanView,
  verifyReceiptFull,
  type NetworkReceipt,
} from '../src';

const VECTORS = join(__dirname, '..', '..', 'SPEC', 'vectors');
const load = (name: string) => JSON.parse(readFileSync(join(VECTORS, name), 'utf8'));

describe('SPEC/vectors/canonical.json', () => {
  const { cases } = load('canonical.json');

  it('reproduces every canonical string and hash', () => {
    for (const vector of cases) {
      const canonical = canonicalize(vector.value);
      expect(canonical).toBe(vector.canonical);
      expect(createHash('sha256').update(canonical, 'utf8').digest('hex')).toBe(vector.sha256Hex);
    }
    expect(cases.length).toBeGreaterThanOrEqual(6);
  });
});

describe('SPEC/vectors/network-receipt.json', () => {
  const vector = load('network-receipt.json');
  const receipt = vector.receipt as NetworkReceipt;
  const keys = { [vector.keys.publicKeyRef]: vector.keys.publicKey };

  it('reproduces the expected receiptHash', () => {
    expect(computeNetworkReceiptHash(receipt)).toBe(vector.expect.receiptHash);
  });

  it('fully verifies (integrity + ed25519 signature)', () => {
    const result = verifyReceiptFull(receipt, { keys });
    expect(result).toMatchObject({ verified: true, integrityOk: true, signatureOk: true });
  });

  it('rejects every must-fail variant', () => {
    expect(vector.mustFail.length).toBeGreaterThanOrEqual(2);
    for (const failing of vector.mustFail) {
      expect({ reason: failing.reason, verified: verifyReceiptFull(failing.receipt, { keys }).verified })
        .toEqual({ reason: failing.reason, verified: false });
    }
  });
});

describe('SPEC/vectors/master-receipt.json', () => {
  const vector = load('master-receipt.json');

  it('reproduces the expected masterHash through the frozen core path', () => {
    expect(vector.master.masterHash).toBe(vector.expect.masterHash);
    expect(verifyMasterReceipt(vector.master).verified).toBe(true);
  });

  it('reproduces the expected HumanView exactly', () => {
    const view = toHumanView(vector.networkReceipt, {
      scores: { vScore: 85.5, completeness: 0.67, parity: 0.96, freshness: 1 },
    });
    expect(view).toEqual(vector.humanView);
  });
});
