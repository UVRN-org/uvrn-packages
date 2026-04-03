import { IdentityRegistry, MockIdentityStore, type ReputationScore } from '../src';

function buildReputation(overrides: Partial<ReputationScore> = {}): ReputationScore {
  return {
    signerAddress: '0xabc',
    score: 90,
    receipts: 120,
    accuracy: 0.9,
    canonRate: 0.95,
    since: '2026-01-01T00:00:00.000Z',
    lastSeen: '2026-04-01T00:00:00.000Z',
    level: 'trusted',
    ...overrides,
  };
}

describe('@uvrn/identity', () => {
  it('reputation() returns the stored score for a known signer', async () => {
    const store = new MockIdentityStore();
    const expected = buildReputation();
    await store.saveReputation(expected);
    const registry = new IdentityRegistry({ store });

    await expect(registry.reputation('0xabc')).resolves.toEqual(expected);
  });

  it('reputation() returns null for an unknown address', async () => {
    const registry = new IdentityRegistry({ store: new MockIdentityStore() });

    await expect(registry.reputation('0xmissing')).resolves.toBeNull();
  });

  it('record() updates score, accuracy, canonRate, and receipt totals', async () => {
    const registry = new IdentityRegistry({ store: new MockIdentityStore() });

    await registry.record({
      signerAddress: '0xabc',
      receiptId: 'rec_001',
      vScore: 88,
      consensusVScore: 92,
      canonized: true,
      timestamp: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    const updated = await registry.record({
      signerAddress: '0xabc',
      receiptId: 'rec_002',
      vScore: 60,
      consensusVScore: 90,
      canonized: false,
      timestamp: Date.parse('2026-04-02T00:00:00.000Z'),
    });

    expect(updated.receipts).toBe(2);
    expect(updated.canonRate).toBe(0.5);
    expect(updated.accuracy).toBe(0.5);
    expect(updated.score).toBeCloseTo(40.4, 5);
    expect(updated.level).toBe('new');
  });

  it('reputation formula calculates correctly for a sample data set', async () => {
    const registry = new IdentityRegistry({ store: new MockIdentityStore() });

    const result = await registry.record({
      signerAddress: '0xscore',
      receiptId: 'rec_001',
      vScore: 95,
      consensusVScore: 96,
      canonized: true,
      timestamp: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(result.score).toBeCloseTo(80.2, 5);
    expect(result.accuracy).toBe(1);
    expect(result.canonRate).toBe(1);
  });

  it('level thresholds are applied correctly', async () => {
    const store = new MockIdentityStore();
    await store.saveReputation(buildReputation({ signerAddress: '0xtrusted', level: 'trusted' }));
    await store.saveReputation(
      buildReputation({
        signerAddress: '0xestablished',
        score: 65,
        receipts: 10,
        canonRate: 0.7,
        accuracy: 0.7,
        level: 'established',
      })
    );
    await store.saveReputation(
      buildReputation({
        signerAddress: '0xnew',
        score: 15,
        receipts: 4,
        canonRate: 0.25,
        accuracy: 0.25,
        level: 'new',
      })
    );
    const registry = new IdentityRegistry({ store });

    await expect(registry.reputation('0xtrusted')).resolves.toMatchObject({ level: 'trusted' });
    await expect(registry.reputation('0xestablished')).resolves.toMatchObject({
      level: 'established',
    });
    await expect(registry.reputation('0xnew')).resolves.toMatchObject({ level: 'new' });
    await expect(registry.reputation('0xmissing')).resolves.toBeNull();
  });

  it('MockIdentityStore save, get, record, and leaderboard work', async () => {
    const store = new MockIdentityStore();
    const registry = new IdentityRegistry({ store });

    await store.saveReputation(buildReputation({ signerAddress: '0x2', score: 60, receipts: 20 }));
    await registry.record({
      signerAddress: '0x1',
      receiptId: 'rec_001',
      vScore: 90,
      consensusVScore: 90,
      canonized: true,
      timestamp: Date.parse('2026-04-03T00:00:00.000Z'),
    });

    const leaderboard = await registry.leaderboard({ limit: 2 });

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]?.signerAddress).toBe('0x1');
    expect(leaderboard[1]?.signerAddress).toBe('0x2');
  });
});
