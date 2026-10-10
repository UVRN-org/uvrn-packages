
import { runDeltaEngine } from '../src/core/engine';
import { verifyReceipt } from '../src/core/verification';
import { DeltaBundle } from '../src/types';

describe('Delta Engine - Verification Integrity', () => {
  it('should verify a valid receipt', () => {
    const bundle: DeltaBundle = {
      bundleId: 'verify-ok',
      claim: 'V',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'a', value: 10 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'a', value: 10 }] }
      ]
    };
    const receipt = runDeltaEngine(bundle);
    const result = verifyReceipt(receipt);
    expect(result.verified).toBe(true);
  });

  it('should reject a tampered receipt', () => {
    const bundle: DeltaBundle = {
      bundleId: 'verify-fail',
      claim: 'V',
      thresholdPct: 0.1,
      dataSpecs: [
        { id: '1', label: '1', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'a', value: 10 }] },
        { id: '2', label: '2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'a', value: 10 }] }
      ]
    };
    const receipt = runDeltaEngine(bundle);
    
    // Tamper with data
    const tampered = { ...receipt, deltaFinal: 0.99 };
    
    // Check
    const result = verifyReceipt(tampered);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Hash mismatch/);
  });
});
