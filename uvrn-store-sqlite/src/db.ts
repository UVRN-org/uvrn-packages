/**
 * Shared SQLite handle for every UVRN reference store. One local file holds canon receipts,
 * reputations, timeline snapshots, watch subscriptions, agent state, and the local network
 * receipt outbox — durable AND zero-signup (the file-based zero-external path).
 *
 * Drivers are selected explicitly. `better-sqlite3` remains the default and is required
 * lazily; `node:sqlite` uses Node's built-in DatabaseSync implementation.
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

/** Built-in and legacy-native driver choices supported by this package. */
export type SqliteDriverName = 'better-sqlite3' | 'node:sqlite';

/** Options for opening a UVRN database. Omit `driver` to retain the better-sqlite3 default. */
export interface OpenUvrnDatabaseOptions {
  driver?: SqliteDriverName;
}

/**
 * Internal normalized driver port. Adapters own differences in transactions and pragmas;
 * stores continue to depend only on the smaller SqliteDriverDatabase shape above.
 */
interface SqliteDriver extends SqliteDriverDatabase {
  pragma(sql: string): unknown;
  transaction<T>(work: () => T): T;
}

interface BetterSqlite3Database extends SqliteDriverDatabase {
  pragma(sql: string): unknown;
  transaction<T>(work: () => T): () => T;
}

interface NodeSqliteDatabase extends SqliteDriverDatabase {}

class BetterSqlite3Driver implements SqliteDriver {
  readonly #database: BetterSqlite3Database;

  constructor(path: string) {
    let BetterSqlite3: new (filename: string) => BetterSqlite3Database;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      BetterSqlite3 = require('better-sqlite3');
    } catch {
      throw new Error(
        '@uvrn/store-sqlite: the optional peer dependency "better-sqlite3" is not installed. ' +
          'Install it (npm i better-sqlite3) or select { driver: "node:sqlite" } on Node >= 23.4.'
      );
    }
    this.#database = new BetterSqlite3(path);
  }

  exec(sql: string): unknown {
    return this.#database.exec(sql);
  }

  prepare(sql: string): ReturnType<SqliteDriverDatabase['prepare']> {
    return this.#database.prepare(sql);
  }

  pragma(sql: string): unknown {
    return this.#database.pragma(sql);
  }

  transaction<T>(work: () => T): T {
    return this.#database.transaction(work)();
  }

  close(): void {
    this.#database.close();
  }
}

class NodeSqliteDriver implements SqliteDriver {
  readonly #database: NodeSqliteDatabase;

  constructor(path: string) {
    let DatabaseSync: new (filename: string) => NodeSqliteDatabase;
    try {
      // Keep this dynamic so the package still builds and imports on Node versions without
      // node:sqlite; selecting this driver is the only operation that requires Node >= 23.4.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ({ DatabaseSync } = require('node:sqlite') as {
        DatabaseSync: new (filename: string) => NodeSqliteDatabase;
      });
    } catch {
      throw new Error(
        '@uvrn/store-sqlite: driver "node:sqlite" requires Node >= 23.4 with DatabaseSync available.'
      );
    }
    this.#database = new DatabaseSync(path);
  }

  exec(sql: string): unknown {
    return this.#database.exec(sql);
  }

  prepare(sql: string): ReturnType<SqliteDriverDatabase['prepare']> {
    return this.#database.prepare(sql);
  }

  pragma(sql: string): unknown {
    return this.#database.prepare(`PRAGMA ${sql}`).all();
  }

  transaction<T>(work: () => T): T {
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.#database.exec('COMMIT');
      return result;
    } catch (cause) {
      this.#database.exec('ROLLBACK');
      throw cause;
    }
  }

  close(): void {
    this.#database.close();
  }
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
 * Use ':memory:' for a throwaway database. The default remains better-sqlite3; select the
 * built-in driver with `{ driver: 'node:sqlite' }`. Passing an already-open compatible
 * database as the second argument remains supported for existing callers.
 */
export function openUvrnDatabase(
  path: string,
  optionsOrDatabase: OpenUvrnDatabaseOptions | SqliteDriverDatabase = {}
): UvrnDatabase {
  if ('exec' in optionsOrDatabase) {
    return new UvrnDatabase(optionsOrDatabase);
  }
  const driver = optionsOrDatabase.driver ?? 'better-sqlite3';
  return new UvrnDatabase(
    driver === 'node:sqlite' ? new NodeSqliteDriver(path) : new BetterSqlite3Driver(path)
  );
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

CREATE TABLE IF NOT EXISTS track_records (
  origin_id  TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  json       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_track_records_updated ON track_records(updated_at);

CREATE TABLE IF NOT EXISTS track_transcriptions (
  sample_id TEXT PRIMARY KEY,
  origin_id TEXT NOT NULL,
  json      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_track_transcriptions_origin ON track_transcriptions(origin_id);

CREATE TABLE IF NOT EXISTS track_revisions (
  revision_id TEXT PRIMARY KEY,
  origin_id   TEXT NOT NULL,
  json        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_track_revisions_origin ON track_revisions(origin_id);

CREATE TABLE IF NOT EXISTS track_forecast_resolutions (
  forecast_id TEXT PRIMARY KEY,
  origin_id   TEXT NOT NULL,
  json        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_track_forecasts_origin ON track_forecast_resolutions(origin_id);
`;
