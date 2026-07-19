/**
 * The node:sqlite path must remain usable when the optional native peer is absent.
 * Throwing from the peer's module factory models a clean install without better-sqlite3.
 */
jest.mock('better-sqlite3', () => {
  throw new Error('better-sqlite3 is intentionally unavailable');
});

import { openUvrnDatabase, SqliteReceiptStore } from '../src';

describe('node:sqlite without native dependencies', () => {
  it('opens a database and runs the durable outbox path', async () => {
    const db = openUvrnDatabase(':memory:', { driver: 'node:sqlite' });
    try {
      const store = new SqliteReceiptStore(db);
      const receiptHash = `sha256:${'c'.repeat(64)}`;
      const receipt = {
        receiptHash,
        schemaVersion: 'uvrn-receipt-4',
      } as never;
      store.save(receipt);

      const report = await store.pushToNetwork({
        submitReceipt: async () => ({ ok: true, status: 200, registryId: 42 }),
      });

      expect(report).toEqual({ pushed: 1, failed: [], remaining: 0 });
      expect(store.get(receiptHash)?.registryId).toBe(42);
    } finally {
      db.close();
    }
  });
});
