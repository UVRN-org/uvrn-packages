/**
 * Shared SQLite handle for every UVRN reference store. One local file holds canon receipts,
 * reputations, timeline snapshots, watch subscriptions, agent state, and the local network
 * receipt outbox — durable AND zero-signup (the file-based zero-external path).
 *
 * Driver: `better-sqlite3` (peer dependency). It is required lazily so merely importing
 * `@uvrn/store-sqlite` types never demands the native module.
 */

export interface SqliteDriverDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

/** UvrnDatabase wraps one open SQLite file with the UVRN schema applied. */
export class UvrnDatabase {
  readonly raw: SqliteDriverDatabase;

  constructor(raw: SqliteDriverDatabase) {
    this.raw = raw;
    this.raw.exec(SCHEMA);
  }

  close(): void {
    this.raw.close();
  }
}

/**
 * openUvrnDatabase opens (or creates) the UVRN SQLite file at `path` and applies the schema.
 * Use ':memory:' for a throwaway database. Pass an already-open better-sqlite3 Database via
 * `driver` to control driver options yourself.
 */
export function openUvrnDatabase(path: string, driver?: SqliteDriverDatabase): UvrnDatabase {
  if (driver) {
    return new UvrnDatabase(driver);
  }
  let BetterSqlite3: new (path: string) => SqliteDriverDatabase;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BetterSqlite3 = require('better-sqlite3');
  } catch {
    throw new Error(
      '@uvrn/store-sqlite: the optional peer dependency "better-sqlite3" is not installed. ' +
        'Install it (npm i better-sqlite3) or inject your own driver via openUvrnDatabase(path, driver).'
    );
  }
  return new UvrnDatabase(new BetterSqlite3(path));
}

/** Additive-only schema. Every table stores the full object as JSON plus indexed columns. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS canon_receipts (
  canon_id     TEXT PRIMARY KEY,
  claim_id     TEXT NOT NULL,
  written_at   TEXT NOT NULL,
  checksum     TEXT NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canon_claim ON canon_receipts(claim_id);

CREATE TABLE IF NOT EXISTS reputations (
  signer_address TEXT PRIMARY KEY,
  score          REAL NOT NULL,
  receipts       REAL NOT NULL,
  last_seen      TEXT NOT NULL,
  json           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reputation_activities (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  signer_address TEXT NOT NULL,
  json           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_signer ON reputation_activities(signer_address);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id  TEXT NOT NULL,
  scored_at_ms INTEGER NOT NULL,
  json      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_claim_time ON timeline_snapshots(claim_id, scored_at_ms);

CREATE TABLE IF NOT EXISTS timeline_canon_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id     TEXT NOT NULL,
  canonized_at_ms INTEGER NOT NULL,
  json         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canon_events_claim_time ON timeline_canon_events(claim_id, canonized_at_ms);

CREATE TABLE IF NOT EXISTS watch_subscriptions (
  id   TEXT PRIMARY KEY,
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_state (
  agent_id TEXT PRIMARY KEY,
  json     TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS network_receipts (
  receipt_hash TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  synced       INTEGER NOT NULL DEFAULT 0,
  synced_at    TEXT,
  registry_id  INTEGER,
  json         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_network_receipts_synced ON network_receipts(synced, created_at);
`;
