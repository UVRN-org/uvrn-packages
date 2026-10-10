export type ReputationLevel = 'trusted' | 'established' | 'new' | 'unknown';

export interface ReputationScore {
  signerAddress: string;
  score: number;
  receipts: number;
  accuracy: number;
  canonRate: number;
  since: string;
  lastSeen: string;
  level: ReputationLevel;
  /**
   * Count of events that carried verified Ed25519 evidence (see `AttestedEvidence`).
   * Additive in v4 — absent on reputations recorded only via the legacy `record()` path.
   */
  attestedReceipts?: number;
}

export interface ReputationActivity {
  signerAddress: string;
  receiptId: string;
  vScore: number;
  consensusVScore: number;
  canonized: boolean;
  timestamp: number;
}

/**
 * Cryptographic evidence attached to a reputation event.
 *
 * The signed payload is the RFC 8785 (JCS) canonicalized JSON of
 * `{ publicKeyRef, receiptHash, schemaVersion, sigVersion: 'uvrn-sig-1', signedAt? }`
 * (sorted keys, no whitespace; `signedAt` included only when present), verified with the
 * Ed25519 public key carried in `publicKey`.
 */
export interface AttestedEvidence {
  /** Prefixed receipt hash the event refers to, e.g. `sha256:…`. */
  receiptHash: string;
  /** Receipt schema version the hash was computed under, e.g. `uvrn-receipt-4`. */
  schemaVersion: string;
  /** Detached Ed25519 signature over the canonical payload. */
  signature: {
    alg: 'ed25519';
    /** Stable reference to the signing key (key id / DID / URL — protocol-opaque). */
    publicKeyRef: string;
    /** Base64 signature bytes. */
    sig: string;
    /** Optional ISO timestamp baked into the signed payload when present. */
    signedAt?: string;
  };
  /** Base64 raw 32-byte Ed25519 public key used to verify `signature.sig`. */
  publicKey: string;
}

/**
 * Input to `IdentityRegistry.recordEvent()` — a reputation activity, optionally carrying
 * verifiable evidence. Events without evidence (or with evidence that fails verification)
 * are still accepted and recorded, but flagged `attested: false` and weighted at the
 * configured unattested discount.
 */
export interface RecordEventArgs extends ReputationActivity {
  evidence?: AttestedEvidence;
}

export interface IdentityStore {
  getReputation(address: string): Promise<ReputationScore | null>;
  saveReputation(rep: ReputationScore): Promise<void>;
  recordActivity(activity: ReputationActivity): Promise<void>;
  listLeaderboard(limit: number): Promise<ReputationScore[]>;
}

export interface IdentityRegistryOptions {
  store: IdentityStore;
  /**
   * Weight applied by `recordEvent()` to events without verified evidence (no evidence,
   * or a signature that fails Ed25519 verification). Default `0.25`. Attested events
   * always weigh `1`.
   */
  unattestedWeight?: number;
  /**
   * Optional half-life (ms) for time decay on `recordEvent()` contributions: an event's
   * weight is multiplied by `2^(-(now - timestamp) / accuracyHalfLifeMs)` before it is
   * applied. Default `undefined` — no decay.
   */
  accuracyHalfLifeMs?: number;
}

export interface LeaderboardOptions {
  limit: number;
}
