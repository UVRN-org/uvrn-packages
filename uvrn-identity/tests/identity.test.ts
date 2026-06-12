import { generateKeyPairSync, sign } from 'node:crypto';

import {
  IdentityRegistry,
  MockIdentityStore,
  type AttestedEvidence,
  type ReputationScore,
} from '../src';

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

  describe('recordEvent()', () => {
    // Builds real, verifiable Ed25519 evidence. The signed payload is constructed manually
    // (sorted keys, no whitespace) so the test independently pins the canonical JCS form.
    function buildSignedEvidence(): AttestedEvidence {
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      const rawPublicKey = publicKey
        .export({ format: 'der', type: 'spki' })
        .subarray(12)
        .toString('base64');

      const receiptHash = `sha256:${'ab'.repeat(32)}`;
      const schemaVersion = 'uvrn-receipt-4';
      const publicKeyRef = 'uvrn:key:test-1';
      const payload = JSON.stringify({
        publicKeyRef,
        receiptHash,
        schemaVersion,
        sigVersion: 'uvrn-sig-1',
      });
      const sig = sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');

      return {
        receiptHash,
        schemaVersion,
        signature: { alg: 'ed25519', publicKeyRef, sig },
        publicKey: rawPublicKey,
      };
    }

    function buildEventArgs(evidence?: AttestedEvidence) {
      return {
        signerAddress: '0xevent',
        receiptId: 'rec_evt_001',
        vScore: 90,
        consensusVScore: 92,
        canonized: true,
        timestamp: Date.parse('2026-04-01T00:00:00.000Z'),
        ...(evidence ? { evidence } : {}),
      };
    }

    it('a correctly signed event is attested and counts fully', async () => {
      const registry = new IdentityRegistry({ store: new MockIdentityStore() });
      const evidence = buildSignedEvidence();

      const result = await registry.recordEvent(buildEventArgs(evidence));

      expect(result.attested).toBe(true);
      expect(result.receipts).toBe(1);
      expect(result.attestedReceipts).toBe(1);
      expect(result.canonRate).toBe(1);
      expect(result.accuracy).toBe(1);
      // In v4 the canonical reputation key for attested events is the public key.
      expect(result.signerAddress).toBe(evidence.publicKey);
      await expect(registry.reputation(evidence.publicKey)).resolves.toMatchObject({
        receipts: 1,
        attestedReceipts: 1,
      });
    });

    it('a tampered signature is still recorded but unattested at weight 0.25', async () => {
      const registry = new IdentityRegistry({ store: new MockIdentityStore() });
      const evidence = buildSignedEvidence();
      // Tamper after signing: the payload no longer matches the signature.
      const tampered: AttestedEvidence = {
        ...evidence,
        receiptHash: `sha256:${'cd'.repeat(32)}`,
      };

      const result = await registry.recordEvent(buildEventArgs(tampered));

      expect(result.attested).toBe(false);
      expect(result.receipts).toBe(0.25);
      expect(result.attestedReceipts).toBe(0);
      // Unattested events stay keyed by the free-string address.
      expect(result.signerAddress).toBe('0xevent');
    });

    it('an event without evidence is accepted but unattested', async () => {
      const registry = new IdentityRegistry({ store: new MockIdentityStore() });

      const result = await registry.recordEvent(buildEventArgs());

      expect(result.attested).toBe(false);
      expect(result.receipts).toBe(0.25);
      expect(result.attestedReceipts).toBe(0);
      await expect(registry.reputation('0xevent')).resolves.toMatchObject({ receipts: 0.25 });
    });

    it('unattestedWeight is configurable', async () => {
      const registry = new IdentityRegistry({
        store: new MockIdentityStore(),
        unattestedWeight: 0.5,
      });

      const result = await registry.recordEvent(buildEventArgs());

      expect(result.attested).toBe(false);
      expect(result.receipts).toBe(0.5);
    });

    it('time decay is off by default — old attested events still count fully', async () => {
      const registry = new IdentityRegistry({ store: new MockIdentityStore() });
      const evidence = buildSignedEvidence();

      const result = await registry.recordEvent({
        ...buildEventArgs(evidence),
        timestamp: Date.parse('2020-01-01T00:00:00.000Z'),
      });

      expect(result.attested).toBe(true);
      expect(result.receipts).toBe(1);
    });

    it('configured accuracyHalfLifeMs decays an event weight by its age', async () => {
      const halfLifeMs = 60_000;
      const registry = new IdentityRegistry({
        store: new MockIdentityStore(),
        accuracyHalfLifeMs: halfLifeMs,
      });
      const evidence = buildSignedEvidence();

      // An attested event exactly one half-life old should weigh ~0.5.
      const result = await registry.recordEvent({
        ...buildEventArgs(evidence),
        timestamp: Date.now() - halfLifeMs,
      });

      expect(result.attested).toBe(true);
      expect(result.receipts).toBeCloseTo(0.5, 2);
    });

    it('legacy record() is unchanged and still counts whole receipts', async () => {
      const registry = new IdentityRegistry({ store: new MockIdentityStore() });

      const result = await registry.record({
        signerAddress: '0xlegacy',
        receiptId: 'rec_legacy',
        vScore: 90,
        consensusVScore: 92,
        canonized: true,
        timestamp: Date.parse('2026-04-01T00:00:00.000Z'),
      });

      expect(result.receipts).toBe(1);
      expect(result.attestedReceipts).toBeUndefined();
    });
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
