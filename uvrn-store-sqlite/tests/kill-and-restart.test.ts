/**
 * Phase 3 acceptance: agent claims, watch subscriptions, and identity scores survive a process
 * restart via the sqlite stores. "Restart" = close the database handle, reopen the same file,
 * construct fresh store/consumer instances, and assert state is back.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { IdentityRegistry } from '@uvrn/identity';
import {
  openUvrnDatabase,
  SqliteAgentStateStore,
  SqliteCanonStore,
  SqliteIdentityStore,
  SqliteReceiptStore,
  SqliteTimelineStore,
  SqliteWatchStore,
  type SqliteDriverName,
  type UvrnDatabase,
} from '../src';

const drivers: SqliteDriverName[] = ['better-sqlite3', 'node:sqlite'];

describe.each(drivers)('kill-and-restart persistence (%s)', (driver) => {
  let dir: string;
  let dbPath: string;
  let db: UvrnDatabase;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'uvrn-sqlite-'));
    dbPath = join(dir, 'uvrn.db');
  });

  afterAll(() => {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function open(): UvrnDatabase {
    // Omission is intentionally exercised for better-sqlite3 to lock the legacy default.
    return driver === 'better-sqlite3'
      ? openUvrnDatabase(dbPath)
      : openUvrnDatabase(dbPath, { driver });
  }

  function restart(): void {
    db.close();
    db = open();
  }

  it('identity scores survive restart through the real IdentityRegistry', async () => {
    db = open();
    const registry = new IdentityRegistry({ store: new SqliteIdentityStore(db) });
    await registry.record({
      signerAddress: 'signer-1',
      receiptId: 'r-1',
      vScore: 80,
      consensusVScore: 82,
      canonized: true,
      timestamp: Date.parse('2026-06-10T12:00:00.000Z'),
    });
    const before = await registry.reputation('signer-1');
    expect(before?.receipts).toBe(1);

    restart();

    const reborn = new IdentityRegistry({ store: new SqliteIdentityStore(db) });
    const after = await reborn.reputation('signer-1');
    expect(after).toEqual(before);
    const leaderboard = await reborn.leaderboard({ limit: 5 });
    expect(leaderboard.map((entry) => entry.signerAddress)).toEqual(['signer-1']);
  });

  it('watch subscriptions survive restart', async () => {
    const store = new SqliteWatchStore(db);
    await store.saveSubscription({
      subscriberId: 'sub-1',
      claimId: 'claim-1',
      notify: { type: 'webhook', url: 'https://example.org/hook' },
    } as never);

    restart();

    const reborn = new SqliteWatchStore(db);
    const all = await reborn.listSubscriptions();
    expect(all).toHaveLength(1);
    expect((all[0] as { subscriberId: string }).subscriberId).toBe('sub-1');
    expect(await reborn.removeSubscription('sub-1')).toBe(true);
    expect(await reborn.getSubscription('sub-1')).toBeNull();
  });

  it('agent state (claims, lastSnapshot, failure counts) survives restart', async () => {
    const store = new SqliteAgentStateStore(db);
    const state = {
      totalRuns: 7,
      claims: {
        'claim-1': {
          registration: { claimId: 'claim-1' },
          lastSnapshot: { claimId: 'claim-1', vScore: 85.5 },
          lastVerifiedAt: '2026-06-10T12:00:00.000Z',
          receiptSequence: 3,
          consecutiveFails: 2,
        },
      },
    };
    await store.saveState('agent-1', state as never);

    restart();

    const reborn = new SqliteAgentStateStore(db);
    expect(await reborn.loadState('agent-1')).toEqual(state);
    expect(await reborn.loadState('missing')).toBeNull();
  });

  it('canon receipts and timeline history survive restart', async () => {
    const canon = new SqliteCanonStore(db);
    const receipt = {
      canon_id: 'canon-1',
      claim_id: 'claim-history',
      canonized_at: '2026-06-10T12:00:00.000Z',
    } as never;
    await canon.write(receipt);

    const timeline = new SqliteTimelineStore(db);
    const snapshot = {
      claimId: 'claim-history',
      scoredAt: '2026-06-10T11:00:00.000Z',
      vScore: 77,
    } as never;
    timeline.addSnapshot(snapshot);
    timeline.addCanonEvent(receipt);

    restart();

    const rebornCanon = new SqliteCanonStore(db);
    expect(await rebornCanon.exists('canon-1')).toBe(true);
    expect(await rebornCanon.read('canon-1')).toEqual(receipt);

    const rebornTimeline = new SqliteTimelineStore(db);
    const from = Date.parse('2026-06-10T00:00:00.000Z');
    const to = Date.parse('2026-06-11T00:00:00.000Z');
    expect(await rebornTimeline.getSnapshots('claim-history', from, to)).toEqual([snapshot]);
    expect(await rebornTimeline.getCanonEvents('claim-history', from, to)).toEqual([receipt]);
  });

  it('receipt outbox survives restart and pushToNetwork syncs oldest-first', async () => {
    const store = new SqliteReceiptStore(db);
    const fakeReceipt = (n: number) =>
      ({ receiptHash: `sha256:${String(n).repeat(64).slice(0, 64)}`, schemaVersion: 'uvrn-receipt-4' }) as never;
    store.save(fakeReceipt(1));
    store.save(fakeReceipt(2));
    store.save(fakeReceipt(1)); // idempotent

    restart();

    const reborn = new SqliteReceiptStore(db);
    expect(reborn.listUnsynced()).toHaveLength(2);

    const submitted: string[] = [];
    const report = await reborn.pushToNetwork({
      submitReceipt: async (receipt) => {
        submitted.push(receipt.receiptHash);
        return { ok: true, status: 200, registryId: submitted.length };
      },
    });
    expect(report).toEqual({ pushed: 2, failed: [], remaining: 0 });
    expect(submitted).toHaveLength(2);
    expect(reborn.get(submitted[0])?.synced).toBe(true);
    expect(reborn.get(submitted[0])?.registryId).toBe(1);
  });

  it('pushToNetwork stops on 5xx (order preserved) and surfaces 4xx without retry-mutation', async () => {
    const store = new SqliteReceiptStore(db);
    const hash = (c: string) => `sha256:${c.repeat(64)}`;
    store.save({ receiptHash: hash('a'), schemaVersion: 'uvrn-receipt-4' } as never);
    store.save({ receiptHash: hash('b'), schemaVersion: 'uvrn-receipt-4' } as never);

    const fiveHundred = await store.pushToNetwork({
      submitReceipt: async () => ({ ok: false, status: 503, error: 'down' }),
    });
    expect(fiveHundred.pushed).toBe(0);
    expect(fiveHundred.failed).toHaveLength(1); // stopped at the first, did not plow on
    expect(fiveHundred.remaining).toBe(2);

    const fourHundred = await store.pushToNetwork({
      submitReceipt: async (receipt) =>
        receipt.receiptHash === hash('a')
          ? { ok: false, status: 400, error: 'bad receipt' }
          : { ok: true, status: 200, registryId: 9 },
    });
    expect(fourHundred.pushed).toBe(1); // continued past the 4xx
    expect(fourHundred.failed).toEqual([{ receiptHash: hash('a'), status: 400, error: 'bad receipt' }]);
    expect(fourHundred.remaining).toBe(1); // the 4xx receipt stays, surfaced to the user
  });
});
