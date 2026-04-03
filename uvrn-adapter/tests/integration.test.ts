/**
 * Integration Tests
 * Tests the full flow from DeltaBundle → DeltaReceipt → DRVC3Receipt
 */

import { Wallet, HDNodeWallet } from 'ethers';
import { 
  runDeltaEngine, 
  verifyReceipt,
  DeltaBundle 
} from '@uvrn/core';
import { wrapInDRVC3, extractDeltaReceipt, validateDRVC3 } from '../src';

describe('Integration: Layer 1 → Layer 2', () => {
  let testWallet: HDNodeWallet;

  beforeAll(() => {
    testWallet = Wallet.createRandom();
  });

  it('should complete full flow: bundle → receipt → DRVC3', async () => {
    // 1. Create a DeltaBundle (input to Layer 1)
    const bundle: DeltaBundle = {
      bundleId: 'integration-test-001',
      claim: 'Integration Test',
      thresholdPct: 0.1,
      dataSpecs: [
        {
          id: 'source-1',
          label: 'Source 1',
          sourceKind: 'metric',
          originDocIds: ['doc-1'],
          metrics: [
            { key: 'revenue', value: 1000 },
            { key: 'users', value: 500 }
          ]
        },
        {
          id: 'source-2',
          label: 'Source 2',
          sourceKind: 'metric',
          originDocIds: ['doc-2'],
          metrics: [
            { key: 'revenue', value: 1050 },
            { key: 'users', value: 510 }
          ]
        }
      ]
    };

    // 2. Run Layer 1 Engine
    const deltaReceipt = runDeltaEngine(bundle);

    // Verify Layer 1 receipt
    const verifyResult = verifyReceipt(deltaReceipt);
    expect(verifyResult.verified).toBe(true);

    // 3. Wrap in DRVC3 (Layer 2)
    const drvc3 = await wrapInDRVC3(deltaReceipt, testWallet, {
      issuer: 'uvrn-integration',
      event: 'delta-reconciliation',
      tags: ['#uvrn', '#integration-test']
    });

    // 4. Validate DRVC3 schema
    const schemaResult = validateDRVC3(drvc3);
    expect(schemaResult.valid).toBe(true);

    // 5. Verify hash chain integrity
    expect(drvc3.integrity.hash).toBe(deltaReceipt.hash);

    // 6. Extract and verify embedded receipt
    const extracted = extractDeltaReceipt(drvc3);
    expect(extracted.hash).toBe(deltaReceipt.hash);
    expect(verifyReceipt(extracted).verified).toBe(true);
  });

  it('should maintain hash integrity through Layer 2 wrapping', async () => {
    const bundle: DeltaBundle = {
      bundleId: 'hash-integrity-test',
      claim: 'Hash Test',
      thresholdPct: 0.05,
      dataSpecs: [
        {
          id: 'a',
          label: 'A',
          sourceKind: 'metric',
          originDocIds: [],
          metrics: [{ key: 'val', value: 100 }]
        },
        {
          id: 'b',
          label: 'B',
          sourceKind: 'metric',
          originDocIds: [],
          metrics: [{ key: 'val', value: 100 }]
        }
      ]
    };

    const receipt = runDeltaEngine(bundle);
    const originalHash = receipt.hash;

    // Wrap multiple times - hash should always match
    const drvc3_1 = await wrapInDRVC3(receipt, testWallet, {
      issuer: 'test',
      event: 'test'
    });

    const drvc3_2 = await wrapInDRVC3(receipt, testWallet, {
      issuer: 'test',
      event: 'test'
    });

    // Envelope metadata differs (receipt_id, timestamp)
    expect(drvc3_1.receipt_id).not.toBe(drvc3_2.receipt_id);
    expect(drvc3_1.timestamp).not.toBe(drvc3_2.timestamp);

    // But hash domain remains identical
    expect(drvc3_1.integrity.hash).toBe(originalHash);
    expect(drvc3_2.integrity.hash).toBe(originalHash);
  });
});
