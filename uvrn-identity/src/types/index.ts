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
}

export interface ReputationActivity {
  signerAddress: string;
  receiptId: string;
  vScore: number;
  consensusVScore: number;
  canonized: boolean;
  timestamp: number;
}

export interface IdentityStore {
  getReputation(address: string): Promise<ReputationScore | null>;
  saveReputation(rep: ReputationScore): Promise<void>;
  recordActivity(activity: ReputationActivity): Promise<void>;
  listLeaderboard(limit: number): Promise<ReputationScore[]>;
}

export interface IdentityRegistryOptions {
  store: IdentityStore;
}

export interface LeaderboardOptions {
  limit: number;
}
