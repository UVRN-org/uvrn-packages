import type { CanonReceipt, StorageProof } from '@uvrn/canon';
import type { DriftReceipt } from '@uvrn/drift';

import { mockDriftSnapshot } from './drift.factory';

function defaultStorageProofs(): StorageProof[] {
  return [
    {
      store: 'supabase',
      location: 'uvrn_canon/canon_test_001',
      written_at: new Date('2026-04-01T00:00:00.000Z').toISOString(),
      checksum: 'hash_test_001',
    },
  ];
}

function mockDriftReceipt(): DriftReceipt {
  return {
    receipt_id: 'rcpt_test_001',
    issuer: 'issuer_test',
    timestamp: new Date('2026-04-01T00:00:00.000Z').toISOString(),
    v_score: 80,
    claim_id: 'clm_test_001',
    components: {
      completeness: 80,
      parity: 80,
      freshness: 80,
    },
    tags: ['#uvrn', '#test'],
    drift: {
      decayed_score: 78,
      delta: -2,
      age_hours: 1,
      curve: 'LINEAR',
      profile: 'default',
      scored_at: new Date('2026-04-01T01:00:00.000Z').toISOString(),
      status: 'STABLE',
      decayed_freshness: 74,
    },
  };
}

export function mockCanonReceipt(overrides: Partial<CanonReceipt> = {}): CanonReceipt {
  return {
    canon_id: 'canon_test_001',
    receipt_id: 'rcpt_test_001',
    claim_id: 'clm_test_001',
    canon_seq: 1,
    drift_receipt: mockDriftReceipt(),
    final_snapshot: mockDriftSnapshot(),
    triggered_by: {
      type: 'manual',
      confirmed_by: 'tester',
      reason: 'unit-test',
    },
    canonized_at: new Date('2026-04-01T02:00:00.000Z').toISOString(),
    canonized_by: 'manual',
    content_hash: 'hash_test_001',
    signature: 'sig_test_001',
    public_key: 'pub_test_001',
    storage_proofs: defaultStorageProofs(),
    certificate: 'DRVC3 v1.01',
    block_state: 'canonized',
    tags: ['#uvrn', '#canonized', '#test'],
    replay_id: 'replay_clm_test_001_1',
    ...overrides,
  };
}
