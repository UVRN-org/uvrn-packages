/**
 * Local NetworkReceipt outbox + pushToNetwork() sync (SPEC/uvrn-network-v1.md §6).
 * This is the local store of the desktop dashboard: receipts persist locally with a synced
 * marker; pushToNetwork() submits unsynced receipts oldest-first to the UVRN registry.
 */

import type { NetworkReceipt } from '@uvrn/receipt';
import type { UvrnDatabase } from './db';

/**
 * WorkerClient is the minimal registry client contract (`POST /receipts` semantics).
 * `@uvrn/sdk` or the portal's client both satisfy it; tests inject a mock.
 */
export interface WorkerClient {
  submitReceipt(
    receipt: NetworkReceipt
  ): Promise<{ ok: boolean; status: number; registryId?: number; error?: string }>;
}

/** One row of the local outbox. */
export interface StoredNetworkReceipt {
  receipt: NetworkReceipt;
  createdAt: string;
  synced: boolean;
  syncedAt?: string;
  registryId?: number;
}

/** PushReport summarizes one pushToNetwork() run — gaps recorded, not hidden. */
export interface PushReport {
  pushed: number;
  failed: Array<{ receiptHash: string; status: number; error?: string }>;
  remaining: number;
}

/**
 * SqliteReceiptStore persists NetworkReceipts locally and syncs them to the network.
 */
export class SqliteReceiptStore {
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  /** save stores a receipt in the outbox (idempotent on receiptHash). */
  save(receipt: NetworkReceipt): void {
    this.#db.raw
      .prepare(
        'INSERT OR IGNORE INTO network_receipts (receipt_hash, created_at, synced, json) VALUES (?, ?, 0, ?)'
      )
      .run(receipt.receiptHash, new Date().toISOString(), JSON.stringify(receipt));
  }

  get(receiptHash: string): StoredNetworkReceipt | null {
    const row = this.#db.raw
      .prepare(
        'SELECT json, created_at, synced, synced_at, registry_id FROM network_receipts WHERE receipt_hash = ?'
      )
      .get(receiptHash) as
      | { json: string; created_at: string; synced: number; synced_at: string | null; registry_id: number | null }
      | undefined;
    if (!row) return null;
    return {
      receipt: JSON.parse(row.json) as NetworkReceipt,
      createdAt: row.created_at,
      synced: row.synced === 1,
      syncedAt: row.synced_at ?? undefined,
      registryId: row.registry_id ?? undefined,
    };
  }

  listUnsynced(): StoredNetworkReceipt[] {
    const rows = this.#db.raw
      .prepare('SELECT json, created_at FROM network_receipts WHERE synced = 0 ORDER BY created_at ASC')
      .all() as Array<{ json: string; created_at: string }>;
    return rows.map((row) => ({
      receipt: JSON.parse(row.json) as NetworkReceipt,
      createdAt: row.created_at,
      synced: false,
    }));
  }

  /**
   * pushToNetwork submits unsynced receipts oldest-first. 2xx marks the row synced; a 5xx
   * stops the run (server trouble — retry later, order preserved); a 4xx records the failure
   * and continues (that receipt is the problem, not the network) — surfaced in the report,
   * never mutated-and-retried. This is one immediate pass; callers own retry scheduling and
   * backoff. Both SQLite drivers execute this same store code.
   */
  async pushToNetwork(client: WorkerClient): Promise<PushReport> {
    const failed: PushReport['failed'] = [];
    let pushed = 0;

    for (const entry of this.listUnsynced()) {
      const hash = entry.receipt.receiptHash;
      let outcome: Awaited<ReturnType<WorkerClient['submitReceipt']>>;
      try {
        outcome = await client.submitReceipt(entry.receipt);
      } catch (cause) {
        failed.push({ receiptHash: hash, status: 0, error: (cause as Error).message });
        break; // transport failure — stop, retry later in order
      }

      if (outcome.ok) {
        this.#db.raw
          .prepare(
            'UPDATE network_receipts SET synced = 1, synced_at = ?, registry_id = ? WHERE receipt_hash = ?'
          )
          .run(new Date().toISOString(), outcome.registryId ?? null, hash);
        pushed += 1;
      } else if (outcome.status >= 500) {
        failed.push({ receiptHash: hash, status: outcome.status, error: outcome.error });
        break;
      } else {
        failed.push({ receiptHash: hash, status: outcome.status, error: outcome.error });
      }
    }

    const remaining = this.listUnsynced().length;
    return { pushed, failed, remaining };
  }
}
