/**
 * The main entry's declarations must not import types from OPTIONAL peers: a strict TS
 * consumer that installs only @uvrn/store-sqlite would hit TS2307 (release test B28).
 * The stores use structural local copies (src/peer-types.ts); this file pins those copies
 * to the real peer types and checks the stores still satisfy the peer interfaces.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type * as Canon from '@uvrn/canon';
import type * as Identity from '@uvrn/identity';
import type * as Timeline from '@uvrn/timeline';
import type * as Drift from '@uvrn/drift';
import type * as Watch from '@uvrn/watch';
import type * as Agent from '@uvrn/agent';
import type * as Local from '../src/peer-types';
import {
  openUvrnDatabase,
  SqliteAgentStateStore,
  SqliteCanonStore,
  SqliteIdentityStore,
  SqliteTimelineStore,
  SqliteWatchStore,
} from '../src';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function assertType<T extends true>(): T | void {
  return undefined;
}

describe('main entry has no optional-peer type imports', () => {
  const OPTIONAL_PEERS = [
    '@uvrn/agent',
    '@uvrn/canon',
    '@uvrn/drift',
    '@uvrn/identity',
    '@uvrn/timeline',
    '@uvrn/track-record',
    '@uvrn/watch',
  ];
  // Every module reachable from src/index.ts (the "." export).
  const MAIN_ENTRY_MODULES = ['index.ts', 'db.ts', 'stores.ts', 'edge-stores.ts', 'receipt-store.ts', 'peer-types.ts'];

  it.each(MAIN_ENTRY_MODULES)('src/%s imports no optional peer', (file) => {
    const source = readFileSync(join(__dirname, '..', 'src', file), 'utf8');
    for (const peer of OPTIONAL_PEERS) {
      expect(source).not.toMatch(new RegExp(`(from|import\\()\\s*['"]${peer}['"]`));
    }
  });

  it('index.ts re-exports exactly the main-entry modules', () => {
    const index = readFileSync(join(__dirname, '..', 'src', 'index.ts'), 'utf8');
    const reexports = [...index.matchAll(/from '\.\/([^']+)'/g)].map((m) => `${m[1]}.ts`);
    for (const r of reexports) expect(MAIN_ENTRY_MODULES).toContain(r);
  });
});

describe('local structural types match the peer packages exactly', () => {
  it('compiles the equality assertions', () => {
    assertType<Equals<Local.CanonReceipt, Canon.CanonReceipt>>();
    assertType<Equals<Local.StorageProof, Canon.StorageProof>>();
    assertType<Equals<Local.StoreType, Canon.StoreType>>();
    assertType<Equals<Local.ReputationScore, Identity.ReputationScore>>();
    assertType<Equals<Local.ReputationActivity, Identity.ReputationActivity>>();
    assertType<Equals<Local.DriftSnapshot, Drift.DriftSnapshot>>();
    assertType<Equals<Local.Subscription, Watch.Subscription>>();
    assertType<Equals<Local.PersistedAgentState, Agent.PersistedAgentState>>();
    expect(true).toBe(true);
  });

  it('stores still satisfy the peer store interfaces', () => {
    const db = openUvrnDatabase(':memory:', { driver: 'node:sqlite' });
    try {
      const canon: Canon.CanonStore = new SqliteCanonStore(db);
      const identity: Identity.IdentityStore = new SqliteIdentityStore(db);
      const timeline: Timeline.TimelineStore = new SqliteTimelineStore(db);
      const watch: Watch.WatchStore = new SqliteWatchStore(db);
      const agent: Agent.AgentStateStore = new SqliteAgentStateStore(db);
      expect([canon, identity, timeline, watch, agent].every(Boolean)).toBe(true);
      expect(canon.type).toBe('sqlite');
    } finally {
      db.close();
    }
  });
});
