// ─────────────────────────────────────────────────────────────
// @uvrn/canon — tests
// ─────────────────────────────────────────────────────────────

import { Canon, MockSigner, MockStore } from '../src/index';
import type { DriftSnapshot, DriftReceipt } from '@uvrn/drift';
import type { CanonConfig } from '../src/types/index';

function makeSnapshot(overrides: Partial<DriftSnapshot> = {}): DriftSnapshot {
  return {
    receiptId:  'receipt_001',
    claimId:    'claim_001',
    scoredAt:   new Date().toISOString(),
    components: { completeness: 90, parity: 88, freshness: 87 },
    vScore:     88,
    decayCurve: 'SIGMOID',
    ageHours:   2,
    driftDelta: 0.3,
    status:     'STABLE',
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<DriftReceipt> = {}): DriftReceipt {
  const base: DriftReceipt = {
    receipt_id:   'receipt_001',
    issuer:       'test.uvrn.org',
    timestamp:    new Date().toISOString(),
    claim_id:     'claim_001',
    v_score:      88,
    components:   { completeness: 90, parity: 88, freshness: 87 },
    drift: {
      decayed_score:     88,
      delta:             0.3,
      age_hours:         2,
      curve:             'SIGMOID',
      profile:           'default',
      scored_at:         new Date().toISOString(),
      status:            'STABLE',
      decayed_freshness: 87,
    },
    tags:         ['#uvrn', '#drvc3', '#drift', '#stable'],
  };
  return { ...base, ...overrides };
}

function makeCanon(storeOverride?: MockStore): Canon {
  const store = storeOverride ?? new MockStore();
  return new Canon({
    stores:      [store],
    signer:      new MockSigner(),
    canonizerId: 'test-canonizer',
    autoSuggest: {
      enabled:         true,
      consecutiveRuns: 3,
      minScore:        85,
      suggestionTtlMs: 60 * 60 * 1000,
    },
  } as CanonConfig);
}

describe('Canon.qualify()', () => {
  it('rejects when score is below minScore', () => {
    const canon = makeCanon();
    const result = canon.qualify('claim_001', makeSnapshot({ vScore: 70 }));
    expect(result.qualifies).toBe(false);
    expect(result.reason).toMatch('below minimum');
  });

  it('rejects when not enough consecutive runs', () => {
    const canon = makeCanon();
    const result = canon.qualify('claim_001', makeSnapshot({ vScore: 90 }));
    expect(result.qualifies).toBe(false);
    expect(result.reason).toMatch('consecutive stable runs');
  });

  it('qualifies after enough consecutive stable runs', async () => {
    const canon = makeCanon();
    const snap  = makeSnapshot({ vScore: 90 });
    await canon.recordRun('claim_001', snap);
    await canon.recordRun('claim_001', snap);
    await canon.recordRun('claim_001', snap);
    const result = canon.qualify('claim_001', snap);
    expect(result.qualifies).toBe(true);
  });
});

describe('Canon.recordRun()', () => {
  it('returns null when not enough runs', async () => {
    const canon = makeCanon();
    const snap  = makeSnapshot({ vScore: 90 });
    const s1 = await canon.recordRun('claim_001', snap);
    const s2 = await canon.recordRun('claim_001', snap);
    expect(s1).toBeNull();
    expect(s2).toBeNull();
  });

  it('emits suggestion after consecutiveRuns stable runs', async () => {
    const canon = makeCanon();
    const snap  = makeSnapshot({ vScore: 90 });
    await canon.recordRun('claim_001', snap);
    await canon.recordRun('claim_001', snap);
    const suggestion = await canon.recordRun('claim_001', snap);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.claim_id).toBe('claim_001');
    expect(suggestion!.status).toBe('pending');
    expect(suggestion!.reason).toBe('stable_consecutive');
  });

  it('resets run count after a non-stable run', async () => {
    const canon = makeCanon();
    const stableSnap   = makeSnapshot({ vScore: 90, status: 'STABLE' });
    const criticalSnap = makeSnapshot({ vScore: 45, status: 'CRITICAL' });
    await canon.recordRun('claim_001', stableSnap);
    await canon.recordRun('claim_001', stableSnap);
    await canon.recordRun('claim_001', criticalSnap);
    await canon.recordRun('claim_001', stableSnap);
    await canon.recordRun('claim_001', stableSnap);
    const result = await canon.recordRun('claim_001', stableSnap);
    expect(result).not.toBeNull();
    expect(result!.consecutive_runs).toBe(3);
  });
});

describe('Canon.canonize()', () => {
  it('produces a valid CanonReceipt', async () => {
    const store = new MockStore();
    const canon = makeCanon(store);
    const snap  = makeSnapshot({ vScore: 90 });

    await canon.recordRun('claim_001', snap);
    await canon.recordRun('claim_001', snap);
    const suggestion = await canon.recordRun('claim_001', snap);
    expect(suggestion).not.toBeNull();

    const result = await canon.canonize({
      driftReceipt:  makeReceipt(),
      finalSnapshot: snap,
      trigger:       { type: 'auto_suggest', confirmed_by: 'shawn', suggestion_id: suggestion!.suggestion_id },
      suggestionId:  suggestion!.suggestion_id,
    });

    expect(result.verified).toBe(true);
    expect(result.receipt.block_state).toBe('canonized');
    expect(result.receipt.certificate).toBe('DRVC3 v1.01');
    expect(result.receipt.canon_id).toMatch(/^canon_/);
    expect(result.receipt.content_hash).toHaveLength(64);
    expect(result.receipt.tags).toContain('#canonized');
    expect(result.storageProofs).toHaveLength(1);
  });

  it('rejects an expired suggestion', async () => {
    const canon = makeCanon();
    const snap = makeSnapshot({ vScore: 90 });
    const suggestion = canon.suggest('claim_001', snap, 'manual_request');
    (suggestion as { expires_at: string }).expires_at = new Date(Date.now() - 1000).toISOString();

    await expect(canon.canonize({
      driftReceipt:  makeReceipt(),
      finalSnapshot: snap,
      trigger:       { type: 'manual', confirmed_by: 'shawn' },
      suggestionId:  suggestion.suggestion_id,
    })).rejects.toThrow('expired');
  });

  it('works with manual trigger (no suggestion required)', async () => {
    const canon = makeCanon();
    const snap  = makeSnapshot({ vScore: 92 });

    const result = await canon.canonize({
      driftReceipt:  makeReceipt(),
      finalSnapshot: snap,
      trigger:       { type: 'manual', confirmed_by: 'shawn', reason: 'auditor requested' },
    });

    expect(result.receipt.triggered_by.type).toBe('manual');
    expect(result.verified).toBe(true);
  });

  it('stores the receipt in all stores', async () => {
    const store = new MockStore();
    const canon = makeCanon(store);

    const result = await canon.canonize({
      driftReceipt:  makeReceipt(),
      finalSnapshot: makeSnapshot(),
      trigger:       { type: 'manual', confirmed_by: 'shawn' },
    });

    const stored = await store.read(result.receipt.canon_id);
    expect(stored).not.toBeNull();
    expect(stored!.canon_id).toBe(result.receipt.canon_id);
  });
});

describe('Canon.verify()', () => {
  it('verifies a legitimate receipt', async () => {
    const canon  = makeCanon();
    const result = await canon.canonize({
      driftReceipt:  makeReceipt(),
      finalSnapshot: makeSnapshot(),
      trigger:       { type: 'manual', confirmed_by: 'shawn' },
    });
    expect(await canon.verify(result.receipt)).toBe(true);
  });

  it('rejects a tampered receipt', async () => {
    const canon  = makeCanon();
    const result = await canon.canonize({
      driftReceipt:  makeReceipt(),
      finalSnapshot: makeSnapshot(),
      trigger:       { type: 'manual', confirmed_by: 'shawn' },
    });
    const tampered = { ...result.receipt };
    tampered.final_snapshot = { ...tampered.final_snapshot, vScore: 99 };
    expect(await canon.verify(tampered)).toBe(false);
  });
});
