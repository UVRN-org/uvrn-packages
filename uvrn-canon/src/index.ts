// ─────────────────────────────────────────────────────────────
// @uvrn/canon — Canon
// The canonization engine.
//
// Three entry points:
//   canon.qualify()   — check if a claim is ready to canonize
//   canon.suggest()   — emit a CanonSuggestion for human review
//   canon.canonize()  — execute canonization (requires confirmation)
//
// The deliberate separation of suggest() and canonize() enforces
// the "both — auto-suggest + manual confirm" pattern.
// The agent calls suggest(). A human (or confirmed system) calls canonize().
// ─────────────────────────────────────────────────────────────

import { sha256, canonicalJson } from './signer/index';
import { MultiStore }            from './store/index';
import type {
  CanonConfig,
  CanonReceipt,
  CanonizeInput,
  CanonizeResult,
  CanonSuggestion,
  QualificationResult,
  SuggestionReason,
} from './types/index';
import type { DriftSnapshot } from '@uvrn/drift';

export class Canon {
  private config:      CanonConfig;
  private multiStore:  MultiStore;
  private suggestions: Map<string, CanonSuggestion> = new Map();
  private stableRuns: Map<string, number> = new Map();

  constructor(config: CanonConfig) {
    this.config     = config;
    this.multiStore = new MultiStore(config.stores);
  }

  qualify(
    claimId:   string,
    snapshot:  DriftSnapshot,
  ): QualificationResult {
    const cfg        = this.config.autoSuggest;
    const score      = snapshot.vScore;
    const runs       = this.stableRuns.get(claimId) ?? 0;
    const suggestion = this.getPendingSuggestion(claimId);

    if (suggestion) {
      return {
        qualifies: true,
        reason:    `Pending suggestion ${suggestion.suggestion_id} awaiting confirmation`,
        suggestion,
      };
    }

    if (score < cfg.minScore) {
      return {
        qualifies: false,
        reason:    `V-Score ${score.toFixed(1)} below minimum ${cfg.minScore}`,
      };
    }

    if (runs < cfg.consecutiveRuns) {
      return {
        qualifies: false,
        reason:    `Only ${runs}/${cfg.consecutiveRuns} consecutive stable runs`,
      };
    }

    return {
      qualifies: true,
      reason:    `${runs} consecutive runs above ${cfg.minScore} — ready`,
    };
  }

  async recordRun(
    claimId:  string,
    snapshot: DriftSnapshot,
  ): Promise<CanonSuggestion | null> {
    const cfg = this.config.autoSuggest;

    if (snapshot.status === 'STABLE' && snapshot.vScore >= cfg.minScore) {
      const current = this.stableRuns.get(claimId) ?? 0;
      this.stableRuns.set(claimId, current + 1);
    } else {
      this.stableRuns.set(claimId, 0);
    }

    if (!cfg.enabled) return null;

    const result = this.qualify(claimId, snapshot);
    if (!result.qualifies || result.suggestion) return result.suggestion ?? null;

    return this.suggest(claimId, snapshot, 'stable_consecutive');
  }

  suggest(
    claimId:   string,
    snapshot:  DriftSnapshot,
    reason:    SuggestionReason,
  ): CanonSuggestion {
    const suggestionId = `sug_${claimId}_${Date.now()}`;
    const now          = new Date();
    const expires      = new Date(now.getTime() + this.config.autoSuggest.suggestionTtlMs);

    const suggestion: CanonSuggestion = {
      suggestion_id:    suggestionId,
      claim_id:         claimId,
      receipt_id:       snapshot.receiptId,
      suggested_at:     now.toISOString(),
      reason,
      qualifying_score: snapshot.vScore,
      consecutive_runs: this.stableRuns.get(claimId) ?? 0,
      expires_at:       expires.toISOString(),
      status:           'pending',
    };

    this.suggestions.set(suggestionId, suggestion);
    return suggestion;
  }

  async canonize(input: CanonizeInput): Promise<CanonizeResult> {
    const { driftReceipt, finalSnapshot, trigger } = input;
    const claimId = driftReceipt.claim_id ?? driftReceipt.receipt_id;
    const decayCurve = (driftReceipt as { decay_curve?: string }).decay_curve ?? driftReceipt.drift?.curve ?? 'default';

    if (input.suggestionId) {
      const suggestion = this.suggestions.get(input.suggestionId);
      if (!suggestion) {
        throw new Error(`[Canon] suggestion ${input.suggestionId} not found`);
      }
      if (suggestion.status !== 'pending') {
        throw new Error(`[Canon] suggestion ${input.suggestionId} is ${suggestion.status}`);
      }
      if (new Date(suggestion.expires_at) < new Date()) {
        suggestion.status = 'expired';
        throw new Error(`[Canon] suggestion ${input.suggestionId} has expired`);
      }
      suggestion.status = 'confirmed';
    }

    const canonSeq = await this.nextCanonSeq(claimId);

    const preHash: Omit<CanonReceipt, 'content_hash' | 'signature' | 'storage_proofs'> = {
      canon_id:       '',
      receipt_id:     driftReceipt.receipt_id,
      claim_id:       claimId,
      canon_seq:      canonSeq,
      drift_receipt:  driftReceipt,
      final_snapshot: finalSnapshot,
      triggered_by:   trigger,
      canonized_at:   new Date().toISOString(),
      canonized_by:   this.config.canonizerId,
      public_key:     this.config.signer.publicKey(),
      certificate:    'DRVC3 v1.01',
      block_state:    'canonized',
      tags:           [
        '#uvrn', '#drvc3', '#canonized',
        `#vscore-${Math.round(finalSnapshot.vScore)}`,
        `#${String(decayCurve).toLowerCase()}`,
      ],
      replay_id:      `replay_${claimId}_${canonSeq}`,
    };

    const contentHash = await sha256(canonicalJson(preHash));
    const signature = await this.config.signer.sign(contentHash);
    const canonId = `canon_${contentHash.slice(0, 16)}`;

    const receipt: CanonReceipt = {
      ...preHash,
      canon_id:      canonId,
      content_hash:  contentHash,
      signature,
      storage_proofs: [],
    };

    const storageProofs = await this.multiStore.writeAll(receipt);
    if (storageProofs.length === 0) {
      throw new Error('[Canon] canonize failed: no storage succeeded; at least one store must persist the receipt');
    }
    receipt.storage_proofs = storageProofs;

    const verified = await this.config.signer.verify(contentHash, signature);
    if (!verified) {
      throw new Error('[Canon] post-write signature verification failed');
    }

    return { receipt, storageProofs, verified };
  }

  dismiss(suggestionId: string): void {
    const suggestion = this.suggestions.get(suggestionId);
    if (suggestion) {
      suggestion.status = 'dismissed';
      this.stableRuns.set(suggestion.claim_id, 0);
    }
  }

  pendingSuggestions(): CanonSuggestion[] {
    const now = new Date();
    return Array.from(this.suggestions.values()).filter(s => {
      if (s.status !== 'pending') return false;
      if (new Date(s.expires_at) < now) {
        s.status = 'expired';
        return false;
      }
      return true;
    });
  }

  async verify(receipt: CanonReceipt): Promise<boolean> {
    try {
      const { content_hash, signature, storage_proofs, public_key, ...rest } = receipt;
      const preHash = { ...rest, canon_id: '', public_key };
      const recomputed = await sha256(canonicalJson(preHash));
      if (recomputed !== content_hash) return false;
      return await this.config.signer.verifyWithPublicKey(content_hash, signature, public_key);
    } catch {
      return false;
    }
  }

  private getPendingSuggestion(claimId: string): CanonSuggestion | null {
    const now = new Date();
    for (const s of this.suggestions.values()) {
      if (s.claim_id === claimId && s.status === 'pending') {
        if (new Date(s.expires_at) < now) {
          s.status = 'expired';
          continue;
        }
        return s;
      }
    }
    return null;
  }

  private async nextCanonSeq(claimId: string): Promise<number> {
    let count = 0;
    for (const s of this.suggestions.values()) {
      if (s.claim_id === claimId && s.status === 'confirmed') count++;
    }
    return count + 1;
  }
}

export { sha256, canonicalJson, NodeSigner, MockSigner } from './signer/index';
export { MultiStore, MockStore, R2Store, SupabaseStore, IpfsStore } from './store/index';
export type { CanonConfig, CanonReceipt, CanonSuggestion, CanonStore, CanonSigner, CanonizeInput, CanonizeResult, QualificationResult, StorageProof, StoreType } from './types/index';
