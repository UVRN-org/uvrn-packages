# @uvrn/agent

> Continuous claim monitoring loop for the UVRN protocol.

Part of the [UVRN](https://uvrn.org) ecosystem. Depends on `@uvrn/drift` for scoring and `@uvrn/core` for receipt types.

---

## What it does

`@uvrn/agent` is the heartbeat. It:

1. **Registers claims** — each with a query, a drift profile, and an interval
2. **Calls FARM** on each interval to fetch fresh sources
3. **Calls `@uvrn/drift`** to score the result and detect threshold crossings
4. **Emits an unsigned drift receipt** (`AgentDriftReceipt`) — score, threshold events, and metadata for every run. This is a monitoring envelope, not a signed DRVC3 receipt.

To get **signed, replayable DRVC3 receipts**, wire the agent’s receipt emitter to `@uvrn/canon`: pass each emitted receipt (or its drift snapshot) into canon’s pipeline so canon can sign and persist. The agent does not depend on canon; you connect them in your app.

**Package provides:** `Agent`, emitters (`ConsoleEmitter`, `FileEmitter`, `WebhookEmitter`, `MultiEmitter`), `MockFarmConnector`, `PROFILES`. Registration, interval loop, drift scoring via `@uvrn/drift`, and emission of unsigned `AgentDriftReceipt`s.

**You provide:** A `FarmConnector` (to fetch sources for each claim) and a `ReceiptEmitter` (where to send receipts). Claims to register (id, query, drift profile, interval). Optional: wire to `@uvrn/canon` for signed receipts.

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

## License

MIT · [uvrn.org](https://uvrn.org)
