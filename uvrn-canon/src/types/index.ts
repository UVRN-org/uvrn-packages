// ─────────────────────────────────────────────────────────────
// @uvrn/canon — types
// The canonical receipt is the final form of a UVRN proof.
// Once canonized, a receipt is immutable. Forever.
// ─────────────────────────────────────────────────────────────

import type { DriftReceipt, DriftSnapshot } from '@uvrn/drift';

// ── The canonized receipt — full DRVC3 envelope ───────────
// This is the patent claim made tangible.
// Every field is locked at canonization time and cannot change.
//
export interface CanonReceipt {
  // ── Identity ────────────────────────────────────────────
  canon_id:       string;      // 'canon_' + sha256(content)[:16]
  receipt_id:     string;      // original drift receipt id
  claim_id:       string;      // original claim id
  canon_seq:      number;      // nth canonization of this claim

  // ── The locked proof ────────────────────────────────────
  drift_receipt:  DriftReceipt;      // full receipt at time of canon
  final_snapshot: DriftSnapshot;   // score state that qualified

  // ── Canonization metadata ───────────────────────────────
  triggered_by:   CanonTrigger;     // how it was triggered
  canonized_at:   string;           // ISO timestamp — immutable
  canonized_by:   string;           // agent id or 'manual'

  // ── Integrity ───────────────────────────────────────────
  content_hash:   string;           // SHA-256 of canonical JSON
  signature:      string;           // ed25519 over content_hash
  public_key:     string;           // verifier can check without trust

  // ── Storage proof ───────────────────────────────────────
  // Populated after successful write to each store.
  // Empty array means not yet stored (shouldn't happen).
  storage_proofs: StorageProof[];

  // ── DRVC3 compliance ────────────────────────────────────
  certificate:    'DRVC3 v1.01';
  block_state:    'canonized';      // always canonized — never loose
  tags:           string[];        // includes #canonized
  replay_id:      string;          // unique replay handle
}

// ── What triggered the canonization ──────────────────────
export type CanonTrigger =
  | { type: 'auto_suggest'; confirmed_by: string; suggestion_id: string }
  | { type: 'manual';       confirmed_by: string; reason?: string };

// ── Proof that a store accepted the receipt ───────────────
export interface StorageProof {
  store:       StoreType;
  location:    string;       // URL, CID, or DB row id
  written_at:  string;       // ISO
  checksum:    string;       // store's own checksum/etag
}

export type StoreType = 'r2' | 'supabase' | 'ipfs';

// ── Auto-suggestion — agent recommends canonization ───────
// The agent emits this when a claim qualifies.
// A human (or system) must confirm before canon runs.
//
export interface CanonSuggestion {
  suggestion_id:    string;
  claim_id:         string;
  receipt_id:       string;
  suggested_at:     string;
  reason:           SuggestionReason;
  qualifying_score: number;
  consecutive_runs: number;
  expires_at:       string;    // suggestion is valid for N hours
  status:           'pending' | 'confirmed' | 'dismissed' | 'expired';
}

export type SuggestionReason =
  | 'stable_consecutive'   // N runs above threshold
  | 'time_survived'        // X hours without critical drop
  | 'manual_request';      // user explicitly asked

// ── Canon store interface ──────────────────────────────────
// Implement this for R2, Supabase, IPFS, or anything else.
//
export interface CanonStore {
  type:   StoreType;
  write(receipt: CanonReceipt): Promise<StorageProof>;
  read(canonId: string): Promise<CanonReceipt | null>;
  exists(canonId: string): Promise<boolean>;
}

// ── Canon config ──────────────────────────────────────────
export interface CanonConfig {
  // Storage — MultiStore fans out to all
  stores: CanonStore[];

  // Signer — provides ed25519 key pair
  signer: CanonSigner;

  // Auto-suggestion rules
  autoSuggest: {
    enabled:          boolean;
    consecutiveRuns:  number;    // default 3 — runs above threshold
    minScore:         number;   // default 85 — must be stable here
    suggestionTtlMs:  number;    // default 24h — suggestion expires
  };

  // Who is canonizing (written into receipt)
  canonizerId: string;           // e.g. 'uvrn-agent-prod-01'
}

// ── Signer interface ──────────────────────────────────────
// Implement with Node crypto, WebCrypto, or a KMS.
//
export interface CanonSigner {
  sign(data: string): Promise<string>;       // returns base64 signature
  publicKey(): string;                        // base64 public key
  verify(data: string, sig: string): Promise<boolean>;
  /** Verify using an arbitrary public key (e.g. receipt.public_key) for third-party verification. */
  verifyWithPublicKey(data: string, sig: string, publicKeyB64: string): Promise<boolean>;
}

// ── Input to canonize() ───────────────────────────────────
export interface CanonizeInput {
  driftReceipt:   DriftReceipt;
  finalSnapshot:  DriftSnapshot;
  trigger:        CanonTrigger;
  suggestionId?:  string;
}

// ── Result of canonize() ──────────────────────────────────
export interface CanonizeResult {
  receipt:        CanonReceipt;
  storageProofs:  StorageProof[];
  verified:       boolean;         // signature verified post-write
}

// ── Qualification check result ────────────────────────────
export interface QualificationResult {
  qualifies:        boolean;
  reason:           string;
  suggestion?:      CanonSuggestion;
}
