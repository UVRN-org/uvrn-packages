# @uvrn/store-sqlite

Every UVRN store interface implemented against **one local SQLite file** — durable *and*
zero-signup. This is the file-based zero-external path: state survives restarts without any
service account, and the same file + interfaces are the local store of the UVRN desktop
dashboard.

## What it implements

| Class | Interface (owner) | Persists |
|---|---|---|
| `SqliteCanonStore` | `CanonStore` (`@uvrn/canon`) | canonized receipts (immutable, INSERT OR IGNORE) |
| `SqliteIdentityStore` | `IdentityStore` (`@uvrn/identity`) | reputation scores + activity history |
| `SqliteTimelineStore` | `TimelineStore` (`@uvrn/timeline`) + write side | drift snapshots + canon events |
| `SqliteWatchStore` | `WatchStore` (`@uvrn/watch`, v4) | watcher subscriptions |
| `SqliteAgentStateStore` | `AgentStateStore` (`@uvrn/agent`, v4) | agent claims, last snapshots, failure counts |
| `SqliteReceiptStore` | — (this package) | local NetworkReceipt outbox + `pushToNetwork()` |

Storage stays an **injected interface** — protocol packages ship no storage of their own
(house rule); this package is one reference implementation. In-memory mocks remain the
zero-dependency default everywhere.

## Driver

`better-sqlite3` is an **optional peer dependency**, required lazily — importing this package's
types never demands the native module. Bring your own driver via
`openUvrnDatabase(path, driver)` if you prefer (anything with `exec/prepare/close`).

## Quickstart

```ts
import { openUvrnDatabase, SqliteIdentityStore, SqliteAgentStateStore,
         SqliteWatchStore, SqliteReceiptStore } from '@uvrn/store-sqlite';
import { IdentityRegistry } from '@uvrn/identity';

const db = openUvrnDatabase('./uvrn.db');           // ':memory:' for throwaway

const registry = new IdentityRegistry({ store: new SqliteIdentityStore(db) });
// ... agent: new Agent({ ..., stateStore: new SqliteAgentStateStore(db) })
// ... watcher: new Watcher({ ..., store: new SqliteWatchStore(db) })
```

## pushToNetwork — the satellite sync (SPEC/uvrn-network-v1.md §6)

```ts
const outbox = new SqliteReceiptStore(db);
outbox.save(signedNetworkReceipt);                  // idempotent on receiptHash

const report = await outbox.pushToNetwork(workerClient);
// { pushed, failed: [{receiptHash, status, error}], remaining }
```

Unsynced receipts submit **oldest-first**. A 2xx marks the row synced; a 5xx or transport
failure stops the run (server trouble — retry later, order preserved); a 4xx is surfaced in the
report and the receipt stays in the outbox for you to inspect — never mutated-and-retried.

`WorkerClient` is the minimal contract `{ submitReceipt(receipt) → { ok, status, registryId? } }`;
any client of the registry's `POST /receipts` satisfies it.

## Schema

Additive-only; every table stores the full object as JSON plus indexed query columns. The file
is yours — back it up by copying it.
