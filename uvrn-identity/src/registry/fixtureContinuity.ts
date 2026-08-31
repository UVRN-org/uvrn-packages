/**
 * Local/fixture continuity helpers for D6.
 *
 * “Persistent” here means a reloadable JSON snapshot of MockIdentityStore state —
 * not live remote identity. Live sinks remain Admin/D9-gated.
 */

import type { ReputationActivity, ReputationScore } from '../types';
import { MockIdentityStore } from './IdentityRegistry';

/** Schema id for fixture continuity snapshots (package-local only). */
export const FIXTURE_CONTINUITY_SCHEMA = 'uvrn-identity-fixture-continuity-1';

export interface FixtureContinuitySnapshot {
  schema: typeof FIXTURE_CONTINUITY_SCHEMA;
  reputations: ReputationScore[];
  activities: ReputationActivity[];
}

/**
 * Export the current MockIdentityStore contents into a JSON-serializable snapshot.
 * Order of reputations/activities is deterministic (signerAddress, then receiptId/timestamp).
 */
export async function exportFixtureSnapshot(
  store: MockIdentityStore
): Promise<FixtureContinuitySnapshot> {
  const reputations = await store.listLeaderboard(Number.MAX_SAFE_INTEGER);
  reputations.sort((a, b) => a.signerAddress.localeCompare(b.signerAddress));

  const activities: ReputationActivity[] = [];
  for (const rep of reputations) {
    const list = await store.listActivities(rep.signerAddress);
    activities.push(...list);
  }
  activities.sort((a, b) => {
    const bySigner = a.signerAddress.localeCompare(b.signerAddress);
    if (bySigner !== 0) return bySigner;
    const byReceipt = a.receiptId.localeCompare(b.receiptId);
    if (byReceipt !== 0) return byReceipt;
    return a.timestamp - b.timestamp;
  });

  return {
    schema: FIXTURE_CONTINUITY_SCHEMA,
    reputations,
    activities,
  };
}

/**
 * Hydrate a fresh MockIdentityStore from a fixture continuity snapshot.
 * Throws if schema is unknown (never invents live remote persistence).
 */
export async function hydrateFixtureSnapshot(
  snapshot: FixtureContinuitySnapshot
): Promise<MockIdentityStore> {
  if (snapshot.schema !== FIXTURE_CONTINUITY_SCHEMA) {
    throw new Error(`unknown fixture continuity schema: ${String(snapshot.schema)}`);
  }

  const store = new MockIdentityStore();
  for (const rep of snapshot.reputations) {
    await store.saveReputation(rep);
  }
  for (const activity of snapshot.activities) {
    await store.recordActivity(activity);
  }
  return store;
}
