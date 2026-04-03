import type {
  IdentityRegistryOptions,
  IdentityStore,
  LeaderboardOptions,
  ReputationActivity,
  ReputationScore,
} from '../types';
import {
  calculateReputationScore,
  createEmptyReputation,
  determineLevel,
} from './reputation';

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

  constructor(options: IdentityRegistryOptions) {
    this.#store = options.store;
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

  async leaderboard(options: LeaderboardOptions): Promise<ReputationScore[]> {
    return this.#store.listLeaderboard(options.limit);
  }
}
