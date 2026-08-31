/**
 * BP-v2.1-LATER-D6 — ephemeral fixture signing → local fixture persistence continuity.
 * Does not exercise live remote identity (D9-blocked).
 */

import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FIXTURE_CONTINUITY_SCHEMA,
  IdentityRegistry,
  MockIdentityStore,
  exportFixtureSnapshot,
  hydrateFixtureSnapshot,
  type AttestedEvidence,
  type FixtureContinuitySnapshot,
} from '../src';

function buildSignedEvidence(): AttestedEvidence {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPublicKey = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(12)
    .toString('base64');

  const receiptHash = `sha256:${'d6'.repeat(32)}`;
  const schemaVersion = 'uvrn-receipt-4';
  const publicKeyRef = 'uvrn:key:d6-continuity-1';
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

describe('D6 ephemeral → local persistent continuity', () => {
  it('attested fixture events survive export → hydrate (package-local persistence)', async () => {
    const ephemeral = new MockIdentityStore();
    const registry = new IdentityRegistry({ store: ephemeral });
    const evidence = buildSignedEvidence();

    const recorded = await registry.recordEvent({
      signerAddress: '0xephemeral',
      receiptId: 'rec_d6_001',
      vScore: 91,
      consensusVScore: 90,
      canonized: true,
      timestamp: Date.parse('2026-08-07T00:00:00.000Z'),
      evidence,
    });

    expect(recorded.attested).toBe(true);
    expect(recorded.signerAddress).toBe(evidence.publicKey);

    const snapshot = await exportFixtureSnapshot(ephemeral);
    expect(snapshot.schema).toBe(FIXTURE_CONTINUITY_SCHEMA);
    expect(snapshot.reputations).toHaveLength(1);
    expect(snapshot.activities).toHaveLength(1);

    const persistent = await hydrateFixtureSnapshot(snapshot);
    const reloaded = new IdentityRegistry({ store: persistent });
    const after = await reloaded.reputation(evidence.publicKey);
    const { attested: _attested, ...scoreOnly } = recorded;

    expect(after).toEqual(scoreOnly);
    expect(after?.attestedReceipts).toBe(1);
    expect(await persistent.listActivities(evidence.publicKey)).toHaveLength(1);
  });

  it('committed continuity fixture hydrates to expected attested reputation shape', async () => {
    const fixturePath = join(__dirname, '..', 'fixtures', 'continuity', 'attested-signer-v1.json');
    const snapshot = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureContinuitySnapshot;

    expect(snapshot.schema).toBe(FIXTURE_CONTINUITY_SCHEMA);
    expect(snapshot.reputations).toHaveLength(1);

    const store = await hydrateFixtureSnapshot(snapshot);
    const registry = new IdentityRegistry({ store });
    const rep = await registry.reputation(snapshot.reputations[0]!.signerAddress);

    expect(rep).toMatchObject({
      signerAddress: snapshot.reputations[0]!.signerAddress,
      receipts: 1,
      attestedReceipts: 1,
      canonRate: 1,
      accuracy: 1,
      level: 'new',
    });
    expect(await store.listActivities(snapshot.reputations[0]!.signerAddress)).toHaveLength(1);
  });

  it('rejects unknown continuity schema (no invent live remote)', async () => {
    await expect(
      hydrateFixtureSnapshot({
        schema: 'not-a-real-schema' as typeof FIXTURE_CONTINUITY_SCHEMA,
        reputations: [],
        activities: [],
      })
    ).rejects.toThrow(/unknown fixture continuity schema/);
  });
});
