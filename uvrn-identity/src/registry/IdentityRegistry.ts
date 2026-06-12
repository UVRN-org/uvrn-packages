import type {
  IdentityRegistryOptions,
  IdentityStore,
  LeaderboardOptions,
  RecordEventArgs,
  ReputationActivity,
  ReputationScore,
} from '../types';
import { verifyAttestedEvidence } from './attestation';
import {
  calculateReputationScore,
  createEmptyReputation,
  determineLevel,
} from './reputation';

const DEFAULT_UNATTESTED_WEIGHT = 0.25;

export class MockIdentityStore implements IdentityStore {
  readonly #reputations = new Map<string, ReputationScore>();
  readonly #activities = new Map<string, ReputationActivity[]>();

  async getReputation(address: string): Promise<ReputationScore | null> {
    return this.#reputations.get(address) ?? null;
  }

  async saveReputation(rep: ReputationScore): Promise<void> {
    this.#reputations.set(rep.signerAddress, rep);
  }

  async recordActivity(activity: ReputationActivity): Promise<void> {
    const activities = this.#activities.get(activity.signerAddress) ?? [];
    activities.push(activity);
    this.#activities.set(activity.signerAddress, activities);
  }

  async listLeaderboard(limit: number): Promise<ReputationScore[]> {
    return [...this.#reputations.values()]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.receipts !== left.receipts) {
          return right.receipts - left.receipts;
        }
        return right.lastSeen.localeCompare(left.lastSeen);
      })
      .slice(0, limit);
  }
}

export class IdentityRegistry {
  readonly #store: IdentityStore;
  readonly #unattestedWeight: number;
  readonly #accuracyHalfLifeMs?: number;

  constructor(options: IdentityRegistryOptions) {
    this.#store = options.store;
    this.#unattestedWeight = options.unattestedWeight ?? DEFAULT_UNATTESTED_WEIGHT;
    this.#accuracyHalfLifeMs = options.accuracyHalfLifeMs;
  }

  async reputation(address: string): Promise<ReputationScore | null> {
    return this.#store.getReputation(address);
  }

  async getOrCreate(address: string): Promise<ReputationScore> {
    const existing = await this.#store.getReputation(address);
    if (existing) {
      return existing;
    }

    const created = createEmptyReputation(address);
    await this.#store.saveReputation(created);
    return created;
  }

  async record(activity: ReputationActivity): Promise<ReputationScore> {
    const existing = await this.getOrCreate(activity.signerAddress);
    const nextReceipts = existing.receipts + 1;
    const canonizedCount = existing.canonRate * existing.receipts + (activity.canonized ? 1 : 0);
    const accurateCount =
      existing.accuracy * existing.receipts +
      (Math.abs(activity.vScore - activity.consensusVScore) <= 10 ? 1 : 0);
    const canonRate = canonizedCount / nextReceipts;
    const accuracy = accurateCount / nextReceipts;
    const lastSeen = new Date(Math.max(Date.parse(existing.lastSeen), activity.timestamp)).toISOString();

    const updated: ReputationScore = {
      signerAddress: activity.signerAddress,
      receipts: nextReceipts,
      canonRate,
      accuracy,
      since: existing.since,
      lastSeen,
      score: calculateReputationScore(canonRate, accuracy, nextReceipts),
      level: determineLevel(
        calculateReputationScore(canonRate, accuracy, nextReceipts),
        nextReceipts
      ),
    };

    await this.#store.recordActivity(activity);
    await this.#store.saveReputation(updated);

    return updated;
  }

  /**
   * Evidence-based reputation recording (v4). Unlike `record()`, which counts every event
   * as a full receipt, `recordEvent()` weights each event by whether it carries verifiable
   * Ed25519 evidence:
   *
   * - **Attested** (evidence present AND signature verifies): weight `1`, and the reputation
   *   is keyed by `evidence.publicKey` — in v4 the canonical reputation key is the public key.
   *   Free-string addresses remain supported for unattested/legacy events.
   * - **Unattested** (no evidence, or verification fails): the event is still accepted and
   *   recorded — never hidden — but flagged `attested: false` and weighted at
   *   `unattestedWeight` (default `0.25`).
   *
   * When `accuracyHalfLifeMs` is configured, the event's weight additionally decays by
   * `2^(-(now - timestamp) / accuracyHalfLifeMs)`. Decay is off by default.
   *
   * `receipts`, `canonRate`, and `accuracy` accumulate the weight instead of a flat `1`;
   * `attestedReceipts` counts attested events only. The legacy `record()` path is unchanged.
   */
  async recordEvent(args: RecordEventArgs): Promise<ReputationScore & { attested: boolean }> {
    const attested = args.evidence !== undefined && verifyAttestedEvidence(args.evidence);
    const signerAddress = attested && args.evidence ? args.evidence.publicKey : args.signerAddress;

    let weight = attested ? 1 : this.#unattestedWeight;
    if (this.#accuracyHalfLifeMs !== undefined) {
      weight *= 2 ** (-(Date.now() - args.timestamp) / this.#accuracyHalfLifeMs);
    }

    const existing = await this.getOrCreate(signerAddress);
    const nextReceipts = existing.receipts + weight;
    const canonizedCount = existing.canonRate * existing.receipts + (args.canonized ? weight : 0);
    const accurateCount =
      existing.accuracy * existing.receipts +
      (Math.abs(args.vScore - args.consensusVScore) <= 10 ? weight : 0);
    const canonRate = nextReceipts > 0 ? canonizedCount / nextReceipts : 0;
    const accuracy = nextReceipts > 0 ? accurateCount / nextReceipts : 0;
    const attestedReceipts = (existing.attestedReceipts ?? 0) + (attested ? 1 : 0);
    const lastSeen = new Date(Math.max(Date.parse(existing.lastSeen), args.timestamp)).toISOString();
    const score = calculateReputationScore(canonRate, accuracy, nextReceipts);

    const updated: ReputationScore = {
      signerAddress,
      receipts: nextReceipts,
      canonRate,
      accuracy,
      since: existing.since,
      lastSeen,
      score,
      level: determineLevel(score, nextReceipts),
      attestedReceipts,
    };

    const activity: ReputationActivity = {
      signerAddress,
      receiptId: args.receiptId,
      vScore: args.vScore,
      consensusVScore: args.consensusVScore,
      canonized: args.canonized,
      timestamp: args.timestamp,
    };

    await this.#store.recordActivity(activity);
    await this.#store.saveReputation(updated);

    return { ...updated, attested };
  }

  async leaderboard(options: LeaderboardOptions): Promise<ReputationScore[]> {
    return this.#store.listLeaderboard(options.limit);
  }
}
