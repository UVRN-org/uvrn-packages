import { mockReceipt } from '../factories/receipt.factory';
import type { Fixtures } from '../types';

export const fixtures: Fixtures = {
  claimId: 'clm_test_001',
  stableReceipt: mockReceipt({
    v_score: 90,
    completeness: 92,
    parity: 89,
    freshness: 88,
    status: 'STABLE',
  }),
  driftingReceipt: mockReceipt({
    v_score: 60,
    completeness: 72,
    parity: 65,
    freshness: 44,
    status: 'DRIFTING',
  }),
  criticalReceipt: mockReceipt({
    v_score: 35,
    completeness: 48,
    parity: 38,
    freshness: 19,
    status: 'CRITICAL',
  }),
};
