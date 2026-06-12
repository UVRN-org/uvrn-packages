// ─────────────────────────────────────────────────────────────
// @uvrn/canon — store unit tests
// R2Store, SupabaseStore, IpfsStore, MultiStore, MockStore
// against in-memory fakes of each backend client.
// ─────────────────────────────────────────────────────────────

import {
  R2Store,
  SupabaseStore,
  IpfsStore,
  MultiStore,
  MockStore,
} from '../src/store/index';
import type { R2Client, SupabaseClient, IpfsClient } from '../src/store/index';
import type { CanonReceipt, CanonStore, StorageProof } from '../src/types/index';

function makeCanonReceipt(overrides: Partial<CanonReceipt> = {}): CanonReceipt {
  return {
    canon_id: 'canon_abc123',
    receipt_id: 'receipt_001',
    claim_id: 'claim_001',
    canon_seq: 1,
    drift_receipt: {
      receipt_id: 'receipt_001',
      issuer: 'test.uvrn.org',
      timestamp: '2026-06-10T00:00:00.000Z',
      claim_id: 'claim_001',
      v_score: 88,
      components: { completeness: 90, parity: 88, freshness: 87 },
      drift: {
        decayed_score: 88,
        delta: 0.3,
        age_hours: 2,
        curve: 'SIGMOID',
        profile: 'default',
        scored_at: '2026-06-10T00:00:00.000Z',
        status: 'STABLE',
        decayed_freshness: 87,
      },
      tags: ['#uvrn'],
    },
    final_snapshot: {
      receiptId: 'receipt_001',
      claimId: 'claim_001',
      scoredAt: '2026-06-10T00:00:00.000Z',
      components: { completeness: 90, parity: 88, freshness: 87 },
      vScore: 88,
      decayCurve: 'SIGMOID',
      ageHours: 2,
      driftDelta: 0.3,
      status: 'STABLE',
    },
    triggered_by: { type: 'manual', confirmed_by: 'tester' },
    canonized_at: '2026-06-10T00:00:00.000Z',
    canonized_by: 'test-canonizer',
    content_hash: 'deadbeef'.repeat(8),
    signature: 'sig',
    public_key: 'pk',
    storage_proofs: [],
    certificate: 'DRVC3 v1.01',
    block_state: 'canonized',
    tags: ['#canonized'],
    replay_id: 'replay_001',
    ...overrides,
  };
}

// ── Fakes ──────────────────────────────────────────────────

function makeFakeR2(options: { headReturnsNull?: boolean } = {}): R2Client & {
  objects: Map<string, string>;
} {
  const objects = new Map<string, string>();
  return {
    objects,
    async put(key: string, value: string) {
      objects.set(key, value);
    },
    async get(key: string) {
      const value = objects.get(key);
      if (value === undefined) return null;
      return { text: async () => value };
    },
    async head(key: string) {
      if (options.headReturnsNull) return null;
      return objects.has(key) ? { etag: `etag-${key}` } : null;
    },
  };
}

function makeFakeSupabase(options: { failInsert?: boolean; failSelect?: boolean } = {}): SupabaseClient & {
  rows: Map<string, Record<string, unknown>>;
} {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    from(_table: string) {
      return {
        async insert(row: Record<string, unknown>) {
          if (options.failInsert) return { error: { message: 'insert denied' } };
          rows.set(row.canon_id as string, row);
          return { error: null };
        },
        select(_cols?: string) {
          return {
            async eq(_col: string, val: unknown) {
              if (options.failSelect) {
                return { data: null, error: { message: 'select denied' } };
              }
              const row = rows.get(val as string);
              return { data: row ? [row] : [], error: null };
            },
          };
        },
      };
    },
  };
}

function makeFakeIpfs(): IpfsClient & { blobs: Map<string, string> } {
  const blobs = new Map<string, string>();
  let counter = 0;
  return {
    blobs,
    async store(content: string) {
      counter += 1;
      const cid = `bafy${counter}`;
      blobs.set(cid, content);
      return { cid };
    },
    async retrieve(cid: string) {
      return blobs.get(cid) ?? null;
    },
  };
}

class FailingStore implements CanonStore {
  readonly type = 'r2';
  async write(): Promise<StorageProof> {
    throw new Error('backend down');
  }
  async read(): Promise<CanonReceipt | null> {
    throw new Error('backend down');
  }
  async exists(): Promise<boolean> {
    throw new Error('backend down');
  }
}

// ── R2Store ────────────────────────────────────────────────

describe('R2Store', () => {
  it('writes the receipt plus a by_canon_id index and returns a proof', async () => {
    const bucket = makeFakeR2();
    const store = new R2Store(bucket);
    const receipt = makeCanonReceipt();

    const proof = await store.write(receipt);

    expect(proof.store).toBe('r2');
    expect(proof.location).toBe('canon/claim_001/canon_abc123.json');
    expect(proof.checksum).toContain('etag-');
    expect(bucket.objects.has('canon/by_canon_id/canon_abc123')).toBe(true);
    expect(Date.parse(proof.written_at)).not.toBeNaN();
  });

  it('respects a custom key prefix', async () => {
    const bucket = makeFakeR2();
    const store = new R2Store(bucket, 'custom-prefix');
    const proof = await store.write(makeCanonReceipt());
    expect(proof.location).toBe('custom-prefix/claim_001/canon_abc123.json');
  });

  it('falls back to content_hash for the checksum when head() yields nothing', async () => {
    const store = new R2Store(makeFakeR2({ headReturnsNull: true }));
    const receipt = makeCanonReceipt();
    const proof = await store.write(receipt);
    expect(proof.checksum).toBe(receipt.content_hash);
  });

  it('reads back by canon_id and reports existence', async () => {
    const store = new R2Store(makeFakeR2());
    const receipt = makeCanonReceipt();
    await store.write(receipt);

    await expect(store.read('canon_abc123')).resolves.toEqual(receipt);
    await expect(store.read('canon_missing')).resolves.toBeNull();
    await expect(store.exists('canon_abc123')).resolves.toBe(true);
    await expect(store.exists('canon_missing')).resolves.toBe(false);
  });
});

// ── SupabaseStore ──────────────────────────────────────────

describe('SupabaseStore', () => {
  it('writes a row and returns a table-scoped proof', async () => {
    const client = makeFakeSupabase();
    const store = new SupabaseStore(client);
    const receipt = makeCanonReceipt();

    const proof = await store.write(receipt);

    expect(proof.store).toBe('supabase');
    expect(proof.location).toBe('uvrn_canon/canon_abc123');
    expect(proof.checksum).toBe(receipt.content_hash);
    expect(client.rows.get('canon_abc123')).toMatchObject({
      claim_id: 'claim_001',
      v_score: 88,
    });
  });

  it('reads back the stored receipt and reports existence', async () => {
    const store = new SupabaseStore(makeFakeSupabase());
    const receipt = makeCanonReceipt();
    await store.write(receipt);

    await expect(store.read('canon_abc123')).resolves.toEqual(receipt);
    await expect(store.read('canon_missing')).resolves.toBeNull();
    await expect(store.exists('canon_abc123')).resolves.toBe(true);
    await expect(store.exists('canon_missing')).resolves.toBe(false);
  });

  it('throws loudly on insert and select errors', async () => {
    const failingInsert = new SupabaseStore(makeFakeSupabase({ failInsert: true }));
    await expect(failingInsert.write(makeCanonReceipt())).rejects.toThrow(
      '[SupabaseStore] write failed: insert denied'
    );

    const failingSelect = new SupabaseStore(makeFakeSupabase({ failSelect: true }));
    await expect(failingSelect.read('canon_abc123')).rejects.toThrow(
      '[SupabaseStore] read failed: select denied'
    );
  });
});

// ── IpfsStore ──────────────────────────────────────────────

describe('IpfsStore', () => {
  it('writes content-addressed and returns an ipfs:// proof', async () => {
    const store = new IpfsStore(makeFakeIpfs());
    const proof = await store.write(makeCanonReceipt());

    expect(proof.store).toBe('ipfs');
    expect(proof.location).toBe(`ipfs://${proof.checksum}`);
  });

  it('reads and checks existence by CID, not canon_id', async () => {
    const store = new IpfsStore(makeFakeIpfs());
    const receipt = makeCanonReceipt();
    const proof = await store.write(receipt);

    await expect(store.read(proof.checksum)).resolves.toEqual(receipt);
    await expect(store.exists(proof.checksum)).resolves.toBe(true);
    // canon_id alone cannot resolve in IPFS — documented behavior.
    await expect(store.read(receipt.canon_id)).resolves.toBeNull();
    await expect(store.exists(receipt.canon_id)).resolves.toBe(false);
  });
});

// ── MultiStore ─────────────────────────────────────────────

describe('MultiStore', () => {
  it('requires at least one store', () => {
    expect(() => new MultiStore([])).toThrow('[MultiStore] must have at least one store');
  });

  it('fans out writes and returns the first successful proof', async () => {
    const a = new MockStore();
    const b = new MockStore();
    const multi = new MultiStore([a, b]);
    const receipt = makeCanonReceipt();

    const proof = await multi.write(receipt);

    expect(proof.location).toBe('mock://canon_abc123');
    await expect(a.exists('canon_abc123')).resolves.toBe(true);
    await expect(b.exists('canon_abc123')).resolves.toBe(true);
  });

  it('survives partial failure with a warning, throws when all stores fail', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const partial = new MultiStore([new FailingStore(), new MockStore()]);
      const proof = await partial.write(makeCanonReceipt());
      expect(proof.store).toBe('r2');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('partial write failure'));

      const broken = new MultiStore([new FailingStore(), new FailingStore()]);
      await expect(broken.write(makeCanonReceipt())).rejects.toThrow(
        '[MultiStore] all stores failed'
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('writeAll returns only the fulfilled proofs', async () => {
    const multi = new MultiStore([new MockStore(), new FailingStore(), new MockStore()]);
    const proofs = await multi.writeAll(makeCanonReceipt());
    expect(proofs).toHaveLength(2);
    expect(proofs.every((p) => p.location === 'mock://canon_abc123')).toBe(true);
  });

  it('read falls through failing stores to the first hit, null when none hit', async () => {
    const backing = new MockStore();
    const receipt = makeCanonReceipt();
    await backing.write(receipt);

    const multi = new MultiStore([new FailingStore(), backing]);
    await expect(multi.read('canon_abc123')).resolves.toEqual(receipt);

    const empty = new MultiStore([new FailingStore(), new MockStore()]);
    await expect(empty.read('canon_abc123')).resolves.toBeNull();
  });

  it('exists is true when any store has the receipt, even with failures', async () => {
    const backing = new MockStore();
    await backing.write(makeCanonReceipt());

    const multi = new MultiStore([new FailingStore(), backing]);
    await expect(multi.exists('canon_abc123')).resolves.toBe(true);

    const empty = new MultiStore([new FailingStore()]);
    await expect(empty.exists('canon_abc123')).resolves.toBe(false);
  });
});

// ── MockStore ──────────────────────────────────────────────

describe('MockStore', () => {
  it('stores in memory and lists everything via all()', async () => {
    const store = new MockStore();
    const first = makeCanonReceipt();
    const second = makeCanonReceipt({ canon_id: 'canon_def456' });

    await store.write(first);
    await store.write(second);

    expect(store.all()).toHaveLength(2);
    await expect(store.read('canon_def456')).resolves.toEqual(second);
    await expect(store.read('canon_missing')).resolves.toBeNull();
  });
});
