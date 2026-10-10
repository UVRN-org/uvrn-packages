// ─────────────────────────────────────────────────────────────
// @uvrn/canon — stores
// Three CanonStore implementations + MultiStore fan-out.
//
// R2Store       — Cloudflare R2 (fits your existing CF Workers stack)
// SupabaseStore — Supabase (queryable receipts, RLS, real-time)
// IpfsStore     — IPFS via web3.storage or nft.storage (true decentralization)
// MultiStore    — fan-out to all three simultaneously
// ─────────────────────────────────────────────────────────────

import type { CanonStore, CanonReceipt, StorageProof, StoreType } from '../types/index';

// ── R2 Store ──────────────────────────────────────────────
export interface R2Client {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  head(key: string): Promise<{ etag: string } | null>;
}

export class R2Store implements CanonStore {
  readonly type: StoreType = 'r2';

  constructor(
    private bucket: R2Client,
    private prefix = 'canon'
  ) {}

  private key(receipt: CanonReceipt): string {
    return `${this.prefix}/${receipt.claim_id}/${receipt.canon_id}.json`;
  }

  /** Key for lookup by canon_id only (index so read(canonId) finds the receipt). */
  private keyByCanonId(canonId: string): string {
    return `${this.prefix}/by_canon_id/${canonId}`;
  }

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    const key     = this.key(receipt);
    const payload = JSON.stringify(receipt, null, 2);

    await this.bucket.put(key, payload, {
      httpMetadata: { contentType: 'application/json' },
    });
    // Index by canon_id so read(canonId) can resolve without claim_id
    await this.bucket.put(this.keyByCanonId(receipt.canon_id), payload, {
      httpMetadata: { contentType: 'application/json' },
    });

    const head = await this.bucket.head(key);

    return {
      store:      'r2',
      location:   key,
      written_at: new Date().toISOString(),
      checksum:   head?.etag ?? receipt.content_hash,
    };
  }

  async read(canonId: string): Promise<CanonReceipt | null> {
    const obj = await this.bucket.get(this.keyByCanonId(canonId));
    if (!obj) return null;
    return JSON.parse(await obj.text()) as CanonReceipt;
  }

  async exists(canonId: string): Promise<boolean> {
    const head = await this.bucket.head(this.keyByCanonId(canonId));
    return head !== null;
  }
}

// ── Supabase Store ────────────────────────────────────────
export interface SupabaseClient {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    select(cols?: string): {
      eq(col: string, val: unknown): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
}

export class SupabaseStore implements CanonStore {
  readonly type: StoreType = 'supabase';

  constructor(
    private client: SupabaseClient,
    private table  = 'uvrn_canon'
  ) {}

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    const row = {
      canon_id:     receipt.canon_id,
      claim_id:     receipt.claim_id,
      canon_seq:    receipt.canon_seq,
      v_score:      receipt.final_snapshot.vScore,
      canonized_at: receipt.canonized_at,
      content_hash: receipt.content_hash,
      receipt:      receipt,
    };

    const { error } = await this.client.from(this.table).insert(row);
    if (error) throw new Error(`[SupabaseStore] write failed: ${error.message}`);

    return {
      store:      'supabase',
      location:   `${this.table}/${receipt.canon_id}`,
      written_at: new Date().toISOString(),
      checksum:   receipt.content_hash,
    };
  }

  async read(canonId: string): Promise<CanonReceipt | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('receipt')
      .eq('canon_id', canonId);

    if (error) throw new Error(`[SupabaseStore] read failed: ${error.message}`);
    if (!data || data.length === 0) return null;

    return (data[0] as { receipt: CanonReceipt }).receipt;
  }

  async exists(canonId: string): Promise<boolean> {
    const { data } = await this.client
      .from(this.table)
      .select('canon_id')
      .eq('canon_id', canonId);

    return Array.isArray(data) && data.length > 0;
  }
}

// ── IPFS Store ────────────────────────────────────────────
export interface IpfsClient {
  store(content: string): Promise<{ cid: string }>;
  retrieve(cid: string): Promise<string | null>;
}

/**
 * IPFS store: content is addressed by CID. For read/exists, pass the CID from
 * the receipt's storage_proofs (proof.checksum or location without "ipfs://"),
 * not the canon_id. Callers that only have canon_id must resolve it via an
 * external index (e.g. from a proof.location stored at write time).
 */
export class IpfsStore implements CanonStore {
  readonly type: StoreType = 'ipfs';

  constructor(private client: IpfsClient) {}

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    const content = JSON.stringify(receipt);
    const { cid }  = await this.client.store(content);

    return {
      store:      'ipfs',
      location:   `ipfs://${cid}`,
      written_at: new Date().toISOString(),
      checksum:   cid,
    };
  }

  /** @param cidOrCanonId — pass the IPFS CID (from storage_proofs[].checksum) to retrieve; canon_id alone cannot resolve. */
  async read(cidOrCanonId: string): Promise<CanonReceipt | null> {
    const content = await this.client.retrieve(cidOrCanonId);
    if (!content) return null;
    return JSON.parse(content) as CanonReceipt;
  }

  /** @param cidOrCanonId — pass the IPFS CID; canon_id alone cannot resolve. */
  async exists(cidOrCanonId: string): Promise<boolean> {
    const content = await this.client.retrieve(cidOrCanonId);
    return content !== null;
  }
}

// ── MultiStore ────────────────────────────────────────────
export class MultiStore implements CanonStore {
  readonly type: StoreType = 'r2';

  constructor(private stores: CanonStore[]) {
    if (stores.length === 0) throw new Error('[MultiStore] must have at least one store');
  }

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    const results = await Promise.allSettled(
      this.stores.map(s => s.write(receipt))
    );

    const proofs   = results
      .filter((r): r is PromiseFulfilledResult<StorageProof> => r.status === 'fulfilled')
      .map(r => r.value);

    const failures = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason);

    if (proofs.length === 0) {
      throw new Error(`[MultiStore] all stores failed: ${failures.map(String).join(', ')}`);
    }

    if (failures.length > 0) {
      console.warn(`[MultiStore] partial write failure (${failures.length}/${results.length} failed)`);
    }

    return proofs[0];
  }

  async writeAll(receipt: CanonReceipt): Promise<StorageProof[]> {
    const results = await Promise.allSettled(
      this.stores.map(s => s.write(receipt))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<StorageProof> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async read(canonId: string): Promise<CanonReceipt | null> {
    for (const store of this.stores) {
      try {
        const receipt = await store.read(canonId);
        if (receipt) return receipt;
      } catch {
        continue;
      }
    }
    return null;
  }

  async exists(canonId: string): Promise<boolean> {
    const checks = await Promise.allSettled(
      this.stores.map(s => s.exists(canonId))
    );
    return checks.some(r => r.status === 'fulfilled' && r.value);
  }
}

// ── Mock store (testing) ──────────────────────────────────
export class MockStore implements CanonStore {
  readonly type: StoreType = 'r2';
  private db = new Map<string, CanonReceipt>();

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    this.db.set(receipt.canon_id, receipt);
    return {
      store:      'r2',
      location:   `mock://${receipt.canon_id}`,
      written_at: new Date().toISOString(),
      checksum:   receipt.content_hash,
    };
  }

  async read(canonId: string): Promise<CanonReceipt | null> {
    return this.db.get(canonId) ?? null;
  }

  async exists(canonId: string): Promise<boolean> {
    return this.db.has(canonId);
  }

  all(): CanonReceipt[] {
    return Array.from(this.db.values());
  }
}
