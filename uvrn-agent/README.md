# @uvrn/agent

> Continuous claim monitoring loop for the UVRN protocol.

Part of the [UVRN](https://uvrn.org) ecosystem. Depends on `@uvrn/drift` for scoring and `@uvrn/core` for receipt types.

## Minimal install

```bash
npm install @uvrn/agent @uvrn/drift @uvrn/core @uvrn/score
```

`@uvrn/agent` declares `@uvrn/drift` as its peer dependency; `@uvrn/drift` in turn peers on `@uvrn/core` and `@uvrn/score`. Install all peer dependencies explicitly — peers are not guaranteed to be auto-installed by your package manager. No other `@uvrn/*` package is required at runtime.

---

## What it does

`@uvrn/agent` is the heartbeat. It:

1. **Registers claims** — each with a query, a drift profile, and an interval
2. **Calls FARM** on each interval to fetch fresh sources
3. **Calls `@uvrn/drift`** to score the result and detect threshold crossings
4. **Emits an unsigned drift receipt** (`AgentDriftReceipt`) — score, threshold events, and metadata for every run. This is a monitoring envelope, not a signed DRVC3 receipt.

To get **signed, replayable DRVC3 receipts**, wire the agent’s receipt emitter to `@uvrn/canon`: pass each emitted receipt (or its drift snapshot) into canon’s pipeline so canon can sign and persist. The agent does not depend on canon; you connect them in your app.

**Package provides:** `Agent`, emitters (`ConsoleEmitter`, `FileEmitter`, `WebhookEmitter`, `MultiEmitter`), `MockFarmConnector`, `InMemoryAgentStateStore`, `PROFILES`. Registration, interval loop, drift scoring via `@uvrn/drift`, and emission of unsigned `AgentDriftReceipt`s.

**You provide:** A `FarmConnector` (to fetch sources for each claim) and a `ReceiptEmitter` (where to send receipts). Claims to register (id, query, drift profile, interval). Optional: wire to `@uvrn/canon` for signed receipts, and inject an `AgentStateStore` for durable state across restarts.

---

## Install

```bash
npm install @uvrn/agent @uvrn/drift @uvrn/core
```

---

## Quick start

```typescript
import { Agent, ConsoleEmitter, MockFarmConnector, PROFILES } from '@uvrn/agent'

const agent = new Agent({
  farmConnector:  new MockFarmConnector(),
  receiptEmitter: new ConsoleEmitter(),
})

agent.register({
  id:          'clm_sol_001',
  label:       '"Exchange X holds full reserves" — audit report',
  query:       'Exchange X proof of reserves 2026',
  driftConfig: PROFILES.solvency,
  intervalMs:  6 * 60 * 60 * 1000,
})

agent
  .on('claim:threshold', event => console.warn('THRESHOLD CROSSED', event))
  .on('receipt:emitted', receipt => { /* save to db */ })
  .start()
```

---

## Emitters

| Emitter | Use |
|---|---|
| `ConsoleEmitter` | Development — logs to stdout |
| `FileEmitter(path)` | NDJSON append |
| `WebhookEmitter(url)` | POST to Supabase, Cloudflare Worker, Discord |
| `MultiEmitter([...])` | Fan out to multiple emitters |

---

## Durable state: `AgentStateStore`

`AgentStateStore` is the injectable persistence seam for the agent's durable state. The agent saves a full `PersistedAgentState` snapshot through the store at every state-changing point — register, unregister, and after every run (success or failure). The snapshot holds each tracked claim's registration, last drift snapshot, last verified time, receipt sequence, and consecutive-failure count, plus the lifetime `totalRuns` counter. The transient `status` field is rederived on restore.

```ts
interface AgentStateStore {
  loadState(agentId: string): Promise<PersistedAgentState | null>;
  saveState(agentId: string, state: PersistedAgentState): Promise<void>;
}
```

The default is `InMemoryAgentStateStore` (zero-dep, process-lifetime only) — existing behavior is unchanged. To survive restarts, inject a durable implementation (e.g. a SQLite-backed store from a reference-store package) and call `restore()` after construction:

```ts
const agent = new Agent({
  farmConnector:  myFarm,
  receiptEmitter: myEmitter,
  stateStore:     new SqliteAgentState(db),
  agentId:        'my-agent',
})

await agent.restore()   // registrations, snapshots, failure counts come back
agent.start()
```

This package ships no storage of its own — stores are injected interfaces (protocol-package house rule).

---

## Clean shutdown

`agent.stop()` (via `Scheduler.stop()` / `stopAll()`) clears every pending timer the scheduler created, so a process — or a Jest worker — holding only the agent exits cleanly. The test suite runs without `--forceExit` and asserts zero pending timers after `stop()`.

---

## License

MIT · [uvrn.org](https://uvrn.org)
