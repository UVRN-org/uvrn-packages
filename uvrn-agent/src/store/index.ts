// ─────────────────────────────────────────────────────────────
// @uvrn/agent — in-memory state store
// ─────────────────────────────────────────────────────────────

import type { AgentStateStore, PersistedAgentState } from '../types/index';

/**
 * Default zero-dependency `AgentStateStore` backed by a `Map`.
 *
 * Used by the `Agent` when no store is injected, preserving the package's
 * historical in-memory behavior (state lives for the process lifetime only).
 * Durable implementations (e.g. `SqliteAgentState` in a reference-store
 * package) implement the same interface and are injected via
 * `AgentConfig.stateStore`. Snapshots are deep-copied on save and load so
 * stored state never aliases live agent state.
 */
export class InMemoryAgentStateStore implements AgentStateStore {
  private readonly states = new Map<string, PersistedAgentState>();

  async loadState(agentId: string): Promise<PersistedAgentState | null> {
    const state = this.states.get(agentId);
    return state ? structuredClone(state) : null;
  }

  async saveState(agentId: string, state: PersistedAgentState): Promise<void> {
    this.states.set(agentId, structuredClone(state));
  }
}
