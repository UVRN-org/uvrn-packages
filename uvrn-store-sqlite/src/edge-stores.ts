/**
 * SQLite implementations of the v4 persistence seams in @uvrn/watch and @uvrn/agent —
 * subscriptions and agent state survive process restarts.
 *
 * Serializability note (from the WatchStore contract): `notify.callback` functions and custom
 * DeliveryTarget instances cannot be persisted; this store round-trips URL-based targets only.
 *
 * Track-record-backed APIs live on the optional subpath `@uvrn/store-sqlite/track-record`
 * so the public main entry does not require the private track-record peer.
 */

import type { Subscription, WatchStore } from '@uvrn/watch';
import type { AgentStateStore, PersistedAgentState } from '@uvrn/agent';
import type { UvrnDatabase } from './db';

/** SqliteWatchStore persists watcher subscriptions keyed by subscriberId. */
export class SqliteWatchStore implements WatchStore {
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.#db.raw
      .prepare(
        'INSERT INTO watch_subscriptions (id, json) VALUES (?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET json = excluded.json'
      )
      .run(subscription.subscriberId, JSON.stringify(subscription));
  }

  async getSubscription(subscriberId: string): Promise<Subscription | null> {
    const row = this.#db.raw
      .prepare('SELECT json FROM watch_subscriptions WHERE id = ?')
      .get(subscriberId) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as Subscription) : null;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    const rows = this.#db.raw
      .prepare('SELECT json FROM watch_subscriptions ORDER BY id ASC')
      .all() as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as Subscription);
  }

  async removeSubscription(subscriberId: string): Promise<boolean> {
    const result = this.#db.raw
      .prepare('DELETE FROM watch_subscriptions WHERE id = ?')
      .run(subscriberId) as { changes: number };
    return result.changes > 0;
  }
}

/** SqliteAgentStateStore persists full agent state snapshots keyed by agent id. */
export class SqliteAgentStateStore implements AgentStateStore {
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  async loadState(agentId: string): Promise<PersistedAgentState | null> {
    const row = this.#db.raw
      .prepare('SELECT json FROM agent_state WHERE agent_id = ?')
      .get(agentId) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as PersistedAgentState) : null;
  }

  async saveState(agentId: string, state: PersistedAgentState): Promise<void> {
    this.#db.raw
      .prepare(
        'INSERT INTO agent_state (agent_id, json, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(agent_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at'
      )
      .run(agentId, JSON.stringify(state), new Date().toISOString());
  }
}
