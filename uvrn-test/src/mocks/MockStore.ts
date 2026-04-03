import type { CanonReceipt, CanonStore, StorageProof } from '@uvrn/canon';

export class MockStore implements CanonStore {
  readonly type = 'supabase' as const;
  readonly records = new Map<string, CanonReceipt>();

  async save(record: CanonReceipt): Promise<string> {
    this.records.set(record.canon_id, record);
    return record.canon_id;
  }

  async get(id: string): Promise<CanonReceipt | null> {
    return this.records.get(id) ?? null;
  }

  async list(claimId: string): Promise<CanonReceipt[]> {
    return Array.from(this.records.values()).filter((record) => record.claim_id === claimId);
  }

  async write(receipt: CanonReceipt): Promise<StorageProof> {
    await this.save(receipt);
    return {
      store: this.type,
      location: `mock-store/${receipt.canon_id}`,
      written_at: new Date('2026-04-01T00:00:00.000Z').toISOString(),
      checksum: receipt.content_hash,
    };
  }

  async read(canonId: string): Promise<CanonReceipt | null> {
    return this.get(canonId);
  }

  async exists(canonId: string): Promise<boolean> {
    return this.records.has(canonId);
  }

  clear(): void {
    this.records.clear();
  }
}
