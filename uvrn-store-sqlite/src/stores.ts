/**
 * SQLite implementations of the UVRN store interfaces (plan A3). Each class implements the
 * interface its protocol package defines — storage stays injected, never moved into protocol
 * packages. All of these share one UvrnDatabase file.
 */

import { createHash } from 'crypto';
import type { CanonReceipt, CanonStore, StorageProof, StoreType } from '@uvrn/canon';
import type {
  IdentityStore,
  ReputationActivity,
  ReputationScore,
} from '@uvrn/identity';
import type { TimelineStore } from '@uvrn/timeline';
import type { DriftSnapshot } from '@uvrn/drift';
import type { UvrnDatabase } from './db';

/**
 * SqliteCanonStore persists canonized receipts. Canon receipts are immutable; writes are
 * INSERT OR IGNORE so a re-write of the same canon_id is a no-op with a fresh proof.
 */
export class SqliteCanonStore implements CanonStore {
  readonly type: StoreType = 'sqlite';
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    const json = JSON.stringify(receipt);
    const checksum = createHash('sha256').update(json, 'utf8').digest('hex');
    const writtenAt = new Date().toISOString();
    this.#db.raw
      .prepare(
        'INSERT OR IGNORE INTO canon_receipts (canon_id, claim_id, written_at, checksum, receipt_json) VALUES (?, ?, ?, ?, ?)'
      )
      .run(receipt.canon_id, receipt.claim_id, writtenAt, checksum, json);
    return {
      store: this.type,
      location: `sqlite:canon_receipts/${receipt.canon_id}`,
      written_at: writtenAt,
      checksum,
    };
  }

  async read(canonId: string): Promise<CanonReceipt | null> {
    const row = this.#db.raw
      .prepare('SELECT receipt_json FROM canon_receipts WHERE canon_id = ?')
      .get(canonId) as { receipt_json: string } | undefined;
    return row ? (JSON.parse(row.receipt_json) as CanonReceipt) : null;
  }

  async exists(canonId: string): Promise<boolean> {
    const row = this.#db.raw
      .prepare('SELECT 1 AS present FROM canon_receipts WHERE canon_id = ?')
      .get(canonId);
    return row !== undefined;
  }
}

/**
 * SqliteIdentityStore persists reputation scores and activity history — identity scores
 * survive process restarts.
 */
export class SqliteIdentityStore implements IdentityStore {
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  async getReputation(address: string): Promise<ReputationScore | null> {
    const row = this.#db.raw
      .prepare('SELECT json FROM reputations WHERE signer_address = ?')
      .get(address) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as ReputationScore) : null;
  }

  async saveReputation(rep: ReputationScore): Promise<void> {
    this.#db.raw
      .prepare(
        'INSERT INTO reputations (signer_address, score, receipts, last_seen, json) VALUES (?, ?, ?, ?, ?) ' +
          'ON CONFLICT(signer_address) DO UPDATE SET score=excluded.score, receipts=excluded.receipts, last_seen=excluded.last_seen, json=excluded.json'
      )
      .run(rep.signerAddress, rep.score, rep.receipts, rep.lastSeen, JSON.stringify(rep));
  }

  async recordActivity(activity: ReputationActivity): Promise<void> {
    this.#db.raw
      .prepare('INSERT INTO reputation_activities (signer_address, json) VALUES (?, ?)')
      .run(activity.signerAddress, JSON.stringify(activity));
  }

  async listLeaderboard(limit: number): Promise<ReputationScore[]> {
    const rows = this.#db.raw
      .prepare('SELECT json FROM reputations ORDER BY score DESC, receipts DESC, last_seen DESC LIMIT ?')
      .all(limit) as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as ReputationScore);
  }
}

/**
 * SqliteTimelineStore implements the read interface @uvrn/timeline expects and adds the write
 * side (`addSnapshot` / `addCanonEvent`) so hosts can append as runs complete.
 */
export class SqliteTimelineStore implements TimelineStore {
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  addSnapshot(snapshot: DriftSnapshot): void {
    this.#db.raw
      .prepare('INSERT INTO timeline_snapshots (claim_id, scored_at_ms, json) VALUES (?, ?, ?)')
      .run(snapshot.claimId, Date.parse(snapshot.scoredAt), JSON.stringify(snapshot));
  }

  addCanonEvent(event: CanonReceipt): void {
    this.#db.raw
      .prepare('INSERT INTO timeline_canon_events (claim_id, canonized_at_ms, json) VALUES (?, ?, ?)')
      .run(event.claim_id, Date.parse(event.canonized_at), JSON.stringify(event));
  }

  async getSnapshots(claimId: string, from: number, to: number): Promise<DriftSnapshot[]> {
    const rows = this.#db.raw
      .prepare(
        'SELECT json FROM timeline_snapshots WHERE claim_id = ? AND scored_at_ms >= ? AND scored_at_ms <= ? ORDER BY scored_at_ms ASC'
      )
      .all(claimId, from, to) as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as DriftSnapshot);
  }

  async getCanonEvents(claimId: string, from: number, to: number): Promise<CanonReceipt[]> {
    const rows = this.#db.raw
      .prepare(
        'SELECT json FROM timeline_canon_events WHERE claim_id = ? AND canonized_at_ms >= ? AND canonized_at_ms <= ? ORDER BY canonized_at_ms ASC'
      )
      .all(claimId, from, to) as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as CanonReceipt);
  }
}
