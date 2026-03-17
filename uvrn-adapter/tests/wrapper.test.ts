/**
 * DRVC3 Wrapper Tests
 * Tests the wrapInDRVC3 function and schema validation
 */

import { Wallet, HDNodeWallet } from 'ethers';
import { runDeltaEngine } from '@uvrn/core';
import { wrapInDRVC3, extractDeltaReceipt } from '../src/wrapper';
import { validateDRVC3 } from '../src/validator';
import { recoverSigner } from '../src/signer';
import type { DeltaReceipt, DeltaBundle } from '@uvrn/core';

describe('DRVC3 Wrapper', () => {
  let mockDeltaReceipt: DeltaReceipt;
  let testWallet: HDNodeWallet;

  beforeAll(() => {
    testWallet = Wallet.createRandom();
    const bundle: DeltaBundle = {
      bundleId: 'test-bundle-001',
      claim: 'Test claim',
      dataSpecs: [
        { id: 's1', label: 'Source A', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'k', value: 10 }] },
        { id: 's2', label: 'Source B', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'k', value: 10.5 }] }
      ],
      thresholdPct: 0.1
    };
    mockDeltaReceipt = runDeltaEngine(bundle);
  });

  it('should wrap DeltaReceipt in valid DRVC3 envelope', async () => {
    const drvc3 = await wrapInDRVC3(mockDeltaReceipt, testWallet, {
      issuer: 'uvrn-test',
      event: 'delta-reconciliation'
    });

    // Check required fields
    expect(drvc3.receipt_id).toMatch(/^drvc3-test-bundle-001-\d+$/);
    expect(drvc3.issuer).toBe('uvrn-test');
    expect(drvc3.event).toBe('delta-reconciliation');
    expect(drvc3.timestamp).toBeDefined();
    expect(drvc3.block_state).toBe('loose');
    expect(drvc3.certificate).toBe('DRVC3 v1.01');

    // Check integrity block
    expect(drvc3.integrity.hash_algorithm).toBe('sha256');
    expect(drvc3.integrity.hash).toBe(mockDeltaReceipt.hash);
    expect(drvc3.integrity.signature_method).toBe('eip191');
    expect(drvc3.integrity.signature).toBeDefined();
    expect(drvc3.integrity.signer_address).toBe(testWallet.address);

    // Check validation block
    expect(drvc3.validation.v_score).toBe(mockDeltaReceipt.deltaFinal);
    expect(drvc3.validation.checks.delta_receipt).toEqual(mockDeltaReceipt);
  });

  it('should produce schema-valid DRVC3 receipt', async () => {
    const drvc3 = await wrapInDRVC3(mockDeltaReceipt, testWallet, {
      issuer: 'uvrn',
      event: 'test'
    });

    const result = validateDRVC3(drvc3);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should include optional fields when provided', async () => {
    const drvc3 = await wrapInDRVC3(mockDeltaReceipt, testWallet, {
      issuer: 'uvrn',
      event: 'delta-reconciliation',
      blockState: 'blocked',
      certificate: 'DRVC3 v1.1',
      description: 'Test receipt',
      tags: ['#uvrn', '#receipt', '#test']
    });

    expect(drvc3.block_state).toBe('blocked');
    expect(drvc3.certificate).toBe('DRVC3 v1.1');
    expect(drvc3.description).toBe('Test receipt');
    expect(drvc3.tags).toEqual(['#uvrn', '#receipt', '#test']);
  });

  it('should create verifiable signature', async () => {
    const drvc3 = await wrapInDRVC3(mockDeltaReceipt, testWallet, {
      issuer: 'uvrn',
      event: 'test'
    });

    // Recover signer from signature
    const recoveredAddress = recoverSigner(
      drvc3.integrity.hash,
      drvc3.integrity.signature
    );

    expect(recoveredAddress.toLowerCase()).toBe(testWallet.address.toLowerCase());
  });

  it('should extract original DeltaReceipt from envelope', async () => {
    const drvc3 = await wrapInDRVC3(mockDeltaReceipt, testWallet, {
      issuer: 'uvrn',
      event: 'test'
    });

    const extracted = extractDeltaReceipt(drvc3);
    expect(extracted.bundleId).toBe(mockDeltaReceipt.bundleId);
    expect(extracted.hash).toBe(mockDeltaReceipt.hash);
    expect(extracted.outcome).toBe(mockDeltaReceipt.outcome);
  });
});
