import { MockFarmConnector, MockSigner, MockStore, fixtures, mockCanonReceipt, mockDriftSnapshot, mockReceipt } from '../src';

describe('@uvrn/test', () => {
  test('mockReceipt produces defaults and applies overrides', () => {
    const receipt = mockReceipt({ v_score: 88, status: 'DRIFTING' });

    expect(receipt.claim_id).toBe('clm_test_001');
    expect(receipt.v_score).toBe(88);
    expect(receipt.status).toBe('DRIFTING');
    expect(receipt.sources).toHaveLength(2);
  });

  test('mockDriftSnapshot applies overrides', () => {
    const snapshot = mockDriftSnapshot({ status: 'CRITICAL', vScore: 39 });

    expect(snapshot.status).toBe('CRITICAL');
    expect(snapshot.vScore).toBe(39);
    expect(snapshot.components.completeness).toBe(80);
  });

  test('MockFarmConnector resolves with latency and tracks calls', async () => {
    const connector = new MockFarmConnector({ latencyMs: 10 });
    const started = Date.now();

    const result = await connector.fetch('sol-price-claim');

    expect(Date.now() - started).toBeGreaterThanOrEqual(8);
    expect(result.claimId).toBe('sol-price-claim');
    expect(connector.callCount).toBe(1);
    expect(connector.calls).toEqual(['sol-price-claim']);

    connector.reset();
    expect(connector.callCount).toBe(0);
  });

  test('MockStore save/get/list work in memory', async () => {
    const store = new MockStore();
    const recordA = mockCanonReceipt({ canon_id: 'canon_a', claim_id: 'clm_a' });
    const recordB = mockCanonReceipt({ canon_id: 'canon_b', claim_id: 'clm_a' });

    await store.save(recordA);
    await store.write(recordB);

    expect(await store.get('canon_a')).toEqual(recordA);
    expect(await store.read('canon_b')).toEqual(recordB);
    expect(await store.list('clm_a')).toHaveLength(2);
    expect(await store.exists('canon_b')).toBe(true);
  });

  test('MockStore does not persist across instances', async () => {
    const first = new MockStore();
    const second = new MockStore();

    await first.save(mockCanonReceipt({ canon_id: 'canon_persist_check' }));

    expect(await second.get('canon_persist_check')).toBeNull();
  });

  test('MockSigner returns a signed envelope and verifies canon-style signatures', async () => {
    const signer = new MockSigner({ address: '0xABC123' });

    const signedEnvelope = await signer.sign(mockReceipt());
    const signature = await signer.sign('payload');

    expect(signedEnvelope).toMatchObject({
      address: '0xABC123',
      receipt: expect.any(Object),
      signature: expect.any(String),
    });
    expect(await signer.verify('payload', signature)).toBe(true);
    expect(await signer.verifyWithPublicKey('payload', signature, signer.publicKey())).toBe(true);
  });

  test('fixtures expose stable, drifting, and critical receipts', () => {
    expect(fixtures.claimId).toBe('clm_test_001');
    expect(fixtures.stableReceipt.status).toBe('STABLE');
    expect(fixtures.driftingReceipt.status).toBe('DRIFTING');
    expect(fixtures.criticalReceipt.status).toBe('CRITICAL');
  });
});
