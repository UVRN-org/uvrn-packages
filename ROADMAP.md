# UVRN Package Roadmap — Open Protocol Specs

**Status:** Active — updated as packages ship
**Last updated:** 2026-03-30

> This document contains the full technical specifications for every upcoming UVRN package. Each spec includes the package intent, public API sketch, dependency requirements, interface contracts, and authoring notes — enough detail to serve as a seed for building a compatible implementation against the UVRN protocol.
>
> **Use this however you want.** Hand a package spec to an AI agent, build it yourself, or use it as a reference for how the protocol fits together. The only rule: implementations that want to interoperate with the official UVRN ecosystem must match the interface contracts defined here.
>
> **Design philosophy — provider-agnostic by default.** Every UVRN package is built around its *interface contract*, not around any specific third-party service. Where packages touch external systems (data sources, storage, delivery channels), they define a pluggable interface that any provider can implement. Reference implementations using free/open APIs are included as examples — not requirements. You bring your own providers. UVRN wires them together.

---

## How to read this document

Each package spec follows a consistent format:

- **What it does** — plain-language intent
- **Layer** — where it sits in the protocol stack (see layer model below)
- **Status** — pre-release (built, audited) or roadmap (design only)
- **Public API sketch** — TypeScript usage examples showing the expected developer interface
- **Dependencies** — what it imports from or peers with
- **Interface contracts** — the types and shapes that must be honored for interop
- **Authoring notes** — design constraints and gotchas

---

## Protocol Layer Model

All 20 UVRN packages are organized across four layers. Every package belongs to exactly one layer.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4 — Distribution & Access                                │
│  @uvrn/embed  @uvrn/watch  @uvrn/mcp  @uvrn/api  @uvrn/cli    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — Temporal & Lifecycle                                 │
│  @uvrn/drift  @uvrn/agent  @uvrn/canon  @uvrn/timeline         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — Receipt & Verification                               │
│  @uvrn/core  @uvrn/sdk  @uvrn/adapter  @uvrn/score             │
│  @uvrn/compare  @uvrn/identity  @uvrn/test                     │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1 — Data & Consensus                                     │
│  @uvrn/farm  @uvrn/consensus  @uvrn/normalize  @uvrn/signal    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Protocol Constants

These values are canonical and must not be redefined by any package. They live in `@uvrn/core`.

**V-Score formula:**
```
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

**Receipt format:** DRVC3 v1.01 — signed JSON, Ed25519 / EIP-191, replayable.

**DriftStatus values:** `'STABLE' | 'DRIFTING' | 'CRITICAL'` — always uppercase.

**TVC Loop:** Test → Validate → Canonize — every receipt flows through this loop.

---

## Key Design Principles

These architectural choices must be preserved in any compatible implementation:

1. **Separation of concern by package.** `@uvrn/agent` does not depend on `@uvrn/canon`. You wire them in your app. No circular deps.
2. **Human confirmation before canonization.** `@uvrn/canon` auto-suggests but never auto-canonizes. A human or explicitly confirmed system trigger must call `canonize()`.
3. **Unsigned receipts from agent.** `@uvrn/agent` emits `AgentDriftReceipt` (monitoring envelope), not a signed DRVC3 receipt. Signing happens in `@uvrn/canon`.
4. **Decay only on freshness.** `@uvrn/drift` decays only the Freshness component. Completeness and Parity are re-scored when new sources arrive.
5. **Protocol-first.** Define the type first. Implementation follows schemas, types, and receipt contracts.
6. **No storage in core packages.** `@uvrn/core`, `@uvrn/drift`, and `@uvrn/agent` have no storage opinions. Storage is `@uvrn/canon`'s job.
7. **LLM-friendliness by design.** Explanation fields should produce output that LLMs can include verbatim in responses.
8. **Provider-agnostic by design.** Every package that touches an external system (data sources, storage backends, delivery channels) defines a pluggable interface. Reference implementations using free/open services are included as examples — not requirements. Users bring their own providers. This is what makes the protocol usable across any stack.
9. **Interfaces are the contract; implementations are examples.** `FarmConnector`, `CanonStore`, `IdentityStore`, `TimelineStore`, `NotifyTarget` — these interfaces are what the protocol depends on. Any implementation that satisfies the interface is a first-class citizen. Reference connectors and stores shipped with the packages are starting points, not defaults to lock into.
10. **Independently installable and independently useful.** Installing `@uvrn/farm` with just `CoinGeckoFarm` should work without pulling in `@uvrn/consensus` or `@uvrn/normalize`. Every package must be useful on its own terms.

---

## Dependency Graph

```
@uvrn/core  (Layer 2 — no deps)
    │
    ├── @uvrn/drift       (Layer 3 — peer: core)
    │       │
    │       ├── @uvrn/agent    (Layer 3 — peer: drift)
    │       │       │
    │       │       └── @uvrn/farm    (Layer 1 — implements agent interface)
    │       │
    │       └── @uvrn/canon   (Layer 3 — peers: core, drift)
    │               │
    │               └── @uvrn/timeline (Layer 3 — deps: core, drift, canon)
    │
    ├── @uvrn/sdk         (Layer 2 — peer: core)
    ├── @uvrn/adapter     (Layer 2 — dep: core)
    ├── @uvrn/score       (Layer 2 — dep: core)
    ├── @uvrn/compare     (Layer 2 — deps: core, drift)
    ├── @uvrn/identity    (Layer 2 — deps: core, adapter)
    └── @uvrn/test        (Layer 2 — peer deps: core, drift, canon)

@uvrn/consensus  (Layer 1 — deps: core, farm)
@uvrn/normalize  (Layer 1 — deps: core, farm)
@uvrn/signal     (Layer 1 — zero deps)

@uvrn/mcp    (Layer 4 — dep: core)
@uvrn/api    (Layer 4 — dep: core)
@uvrn/cli    (Layer 4 — dep: core)
@uvrn/watch  (Layer 4 — deps: agent, drift)
@uvrn/embed  (Layer 4 — peer: core types only)
```

---

## Package Structure Convention

All UVRN packages follow this directory layout:

```
uvrn-{name}/
├── src/
│   ├── index.ts          # single public entry point — all exports here
│   ├── types/
│   │   └── index.ts      # all types exported from here
│   └── [modules]/
├── tests/
│   └── {name}.test.ts
├── dist/                  # generated — never committed
├── package.json
├── tsconfig.json
├── jest.config.js
├── CHANGELOG.md
├── README.md
└── LICENSE
```

Key conventions: `dist/` and `tsconfig.tsbuildinfo` are never committed. All exports go through `src/index.ts`. All types go through `src/types/index.ts`. Use peer deps for `@uvrn/*` inter-package dependencies. Every package needs install-from-tarball smoke verification.

---

## UVRN Official Pre-Release Packages

These three packages are built, tested, and audited. They ship as part of the next official release.

---

### `@uvrn/drift` — Temporal Decay Scoring

**Layer:** 3 — Temporal & Lifecycle
**Status:** Pre-release (built, audited — v1.0.0)

**What it does:** Models how a receipt's V-Score degrades over time. Uses configurable decay curves and claim-type profiles so different kinds of claims (financial vs. research vs. news) can decay at different rates. Only the Freshness component decays — Completeness and Parity are re-scored when new sources arrive.

**Public API sketch:**
```ts
import { DriftEngine, DriftProfiles } from '@uvrn/drift';

const engine = new DriftEngine({
  profile: DriftProfiles.financial,  // pre-built decay curve for financial claims
});

const snapshot = engine.score(receipt, { now: Date.now() });
// snapshot.adjustedScore   → V-Score with freshness decay applied
// snapshot.status          → 'STABLE' | 'DRIFTING' | 'CRITICAL'
// snapshot.freshness       → decayed freshness component value
// snapshot.decayRate       → current decay velocity
```

**Dependencies:** Peer dep on `@uvrn/core` (receipt types, V-Score math)

**Interface contracts:**
- Input: a valid DRVC3 receipt (as produced by `@uvrn/core`)
- Output: `DriftSnapshot` — contains `adjustedScore`, `status` (DriftStatus), `freshness`, `decayRate`, `timestamp`
- `DriftStatus` must be uppercase: `'STABLE' | 'DRIFTING' | 'CRITICAL'`
- Drift profiles are pre-built configs (financial, research, news, general) that set decay curve parameters

---

### `@uvrn/agent` — Continuous Claim Monitoring

**Layer:** 3 — Temporal & Lifecycle
**Status:** Pre-release (built, audited — v1.0.0)

**What it does:** Registers claims, polls on configurable intervals, calls drift scoring, and emits unsigned `AgentDriftReceipt` envelopes. This is the monitoring loop — it watches claims over time and reports when consensus shifts. It does NOT sign receipts (that's canon's job) and does NOT fetch data itself (that's farm's job via the `FarmConnector` interface).

**Public API sketch:**
```ts
import { Agent, AgentConfig } from '@uvrn/agent';

const agent = new Agent({
  farmConnector: myFarmConnector,      // implements FarmConnector interface
  receiptEmitter: myEmitter,           // where AgentDriftReceipts go
  pollInterval: 300_000,               // 5 minutes
  driftProfile: 'financial',
});

agent.register('clm_sol_001', {
  claim: 'SOL will exceed $200 by Q2 2026',
  thresholds: { warn: 70, critical: 50 },
});

agent.start();

agent.on('claim:threshold', (event) => {
  // event.claimId, event.status, event.snapshot
});
```

**Dependencies:** Peer dep on `@uvrn/drift`

**Interface contracts:**
- `FarmConnector` interface — any data source must implement:
  ```ts
  interface FarmConnector {
    fetch(claim: string): Promise<FarmResult>;
  }

  interface FarmResult {
    sources: Array<{
      name: string;
      data: any;
      timestamp: number;
      credibility?: number;
    }>;
  }
  ```
- Output: `AgentDriftReceipt` — unsigned monitoring envelope containing the claim, drift snapshot, and source metadata
- Events: `claim:threshold` fires when a monitored claim crosses a configured threshold boundary

---

### `@uvrn/canon` — Canonization Engine

**Layer:** 3 — Temporal & Lifecycle
**Status:** Pre-release (built, audited — v1.0.0)

**What it does:** Locks a receipt as a permanent, human-confirmed, signed canonical record. Auto-suggests candidates for canonization but never auto-canonizes — a human or explicitly confirmed system trigger must call `canonize()`. Storage is pluggable — bring your own backend.

**Design philosophy:** `@uvrn/canon` defines what canonization *is* (a signed, permanent, human-confirmed record), not where it stores. The `CanonStore` interface is the contract; you provide the implementation. Reference implementations for common backends are included as examples.

**Public API sketch:**
```ts
import { Canon } from '@uvrn/canon';

// Bring your own store — implement CanonStore interface
const canon = new Canon({
  store: myStore,  // any CanonStore implementation
  signer: mySigner,
});

// Auto-suggestion: canon watches for stable receipts
canon.on('suggest', (suggestion) => {
  console.log(suggestion.claimId, suggestion.reason);
  // Human reviews, then:
  const record = await canon.canonize(suggestion.receiptId);
  // record → signed CanonReceipt, stored permanently
});
```

**Dependencies:** Peer deps on `@uvrn/core`, `@uvrn/drift`

**Interface contracts:**
- Input: a DRVC3 receipt (from core) and a drift snapshot (from drift)
- Output: `CanonReceipt` — signed, timestamped, permanently stored record
- `CanonStore` interface — implement to use any storage backend:
  ```ts
  interface CanonStore {
    save(record: CanonReceipt): Promise<string>;    // returns storage ID
    get(id: string): Promise<CanonReceipt | null>;
    list(claimId: string): Promise<CanonReceipt[]>;
  }
  ```
- Reference store implementations included as examples (Supabase, R2, IPFS) — not required
- **Critical design rule:** `canonize()` must always require explicit invocation. Never auto-canonize.

---

## Roadmap Packages

These packages are in the design phase. The specs below define the intended contract — build against them to create interoperable implementations.

---

### `@uvrn/farm` — Data Source Connectors

**Layer:** 1 — Data & Consensus
**Priority:** Highest — the missing input layer

**What it does:** Standardized connector framework for ingesting external data sources — financial feeds, news, research, alt data, or any custom source. Defines the `FarmConnector` interface and provides `BaseConnector` (an abstract class with built-in retry/timeout logic) plus a `MultiFarm` aggregator. Ships with a small set of open/free-tier reference connectors as working examples. You can use these as-is, extend them, or replace them entirely with your own connectors.

**Design philosophy:** `@uvrn/farm` is a connector framework, not a connector dependency. The interface is what matters. Any data source — public API, private feed, local file, custom scraper — can become a `FarmConnector` by implementing one method: `fetch(claim): Promise<FarmResult>`. The reference connectors demonstrate the pattern; they are not required.

**Public API sketch:**
```ts
import { BaseConnector, MultiFarm, FarmConnector, FarmResult } from '@uvrn/farm';

// Use a reference connector (example — swap freely)
import { CoinGeckoFarm } from '@uvrn/farm/connectors';

// Or build your own — implement one method
class MyDataSourceConnector extends BaseConnector {
  readonly name = 'MyDataSource';
  async fetch(claim: string): Promise<FarmResult> {
    const data = await myDataSource.query(claim);
    return { sources: [{ name: this.name, data, timestamp: Date.now(), credibility: 0.9 }] };
  }
}

// Combine any connectors — reference or custom
const farm = new MultiFarm([
  new CoinGeckoFarm(),          // reference connector (no auth needed)
  new MyDataSourceConnector(),  // your connector
]);

// Drop into agent:
const agent = new Agent({ farmConnector: farm, receiptEmitter: emitter });
```

**Dependencies:** Implements `FarmConnector` interface from `@uvrn/agent`. Peer dep on `@uvrn/core` for receipt types.

**Interface contracts:**
- `FarmConnector` — the single interface all connectors implement:
  ```ts
  interface FarmConnector {
    fetch(claim: string): Promise<FarmResult>;
  }
  ```
- `FarmResult` shape: `{ sources: Array<{ name, data, timestamp, credibility? }> }`
- `BaseConnector` — abstract class providing `withRetry()` and `withTimeout()` helpers; extend for any custom connector
- `MultiFarm` fans out to all registered connectors in parallel (`Promise.allSettled`), merges results
- Rate limiting and retry logic live inside each connector — not delegated to the caller

**Reference connectors (bundled as examples):**
- `CoinGeckoFarm` — public crypto market data (no auth required)
- `CoinbaseFarm` — public exchange price data (no auth required)
- `PerplexityFarm` — AI-powered research (API key required)
- `GoogleNewsFarm` / `NewsApiFarm` — news search (API key required)

**Authoring notes:**
- Reference connectors are starting points, not dependencies — swap or replace them without touching the rest of the protocol
- The `ConnectorRegistry` pattern lets you register and discover connectors at runtime
- Each connector is independently usable: `new CoinGeckoFarm()` works standalone with no other `@uvrn/*` packages

---

### `@uvrn/consensus` — Multi-Source Signal Aggregation

**Layer:** 1 — Data & Consensus
**Priority:** High

**What it does:** Aggregates signals across multiple sources into a single consensus score per question. Where `@uvrn/core` validates a bundle (structured input), `@uvrn/consensus` handles the pre-bundle step: gathering, weighting, and collating raw signals into a structured claim bundle for core to score.

**Public API sketch:**
```ts
import { ConsensusEngine, SourceWeight } from '@uvrn/consensus';

const engine = new ConsensusEngine({
  sources: farmResults,
  weights: { credibility: 0.4, recency: 0.3, coverage: 0.3 },
});

const bundle = engine.buildBundle('claim: Exchange X holds full reserves');
// → DataBundle ready for @uvrn/core.runDelta(bundle)
```

**Dependencies:** `@uvrn/core`, `@uvrn/farm` (optional peer)

**Interface contracts:**
- Output of `ConsensusEngine.buildBundle()` must be a valid `DataBundle` that `@uvrn/core` can accept unchanged
- Source weighting is separate from V-Score weighting — do not conflate the two
- v1 can implement simple majority consensus; later versions can add Bayesian aggregation

---

### `@uvrn/normalize` — Source Normalization Layer

**Layer:** 1 — Data & Consensus
**Priority:** Medium

**What it does:** Normalizes raw source data across providers so the delta engine can compare apples to apples. Different data sources return different formats, units, timestamps, and precision levels. This package standardizes them into a common schema before they reach `@uvrn/consensus` or `@uvrn/core`. Ships with four pre-built normalization profiles (financial, research, news, general) and a transformer registration system for custom source types.

**Design philosophy:** `@uvrn/normalize` is profile-driven and extensible. The four built-in profiles handle common cases. For any source type not covered — proprietary feeds, on-chain data, custom formats — register a transformer and it integrates seamlessly. The output schema is the contract; the profiles are just implementations of it.

**Public API sketch:**
```ts
import { normalize, NormalizationProfiles } from '@uvrn/normalize';

// Use a built-in profile
const normalized = normalize(rawFarmResults, NormalizationProfiles.financial);
// → Sources now share common schema: { value, unit, timestamp, credibility }

// Or use a profile by name
const normalized2 = normalize(rawFarmResults, 'research');

// Register a custom transformer for any source type
normalize.registerTransformer('MyCustomSource', (source) => ({
  name: source.name,
  value: source.data.price,
  unit: 'USD',
  timestamp: new Date(source.data.date).getTime(),
  credibility: source.credibility ?? 0.7,
  rawData: source.data,
  normalizer: 'custom',
}));
```

**Dependencies:** `@uvrn/core` (types), `@uvrn/farm` (optional peer)

**Interface contracts:**
- `NormalizationProfile` — pluggable profile interface; implement to support any domain
- Output schema (`NormalizedSource`) is stable and versioned — downstream packages must not break when new source types are added
- Each connector in `@uvrn/farm` can register its own normalizer (transformer pattern)
- Built-in profiles: `financial`, `research`, `news`, `general` — all replaceable or extensible

---

### `@uvrn/signal` — Internal Event Bus

**Layer:** 1 — Data & Consensus
**Priority:** Medium

**What it does:** Internal event bus connecting drift, canon, agent, and watch to external systems. A lightweight typed pub/sub layer so packages can communicate without tight coupling.

**Public API sketch:**
```ts
import { SignalBus } from '@uvrn/signal';

const bus = new SignalBus();

bus.on('drift:threshold', (event) => canon.recordRun(event.claimId, event.snapshot));
bus.on('canon:suggested', (suggestion) => notify(suggestion));
bus.on('agent:receipt', (receipt) => db.save(receipt));

// Packages emit to the bus:
agent.on('claim:threshold', (e) => bus.emit('drift:threshold', e));
```

**Dependencies:** None — zero deps, infrastructure primitive.

**Interface contracts:**
- Thin, typed EventEmitter wrapper — not a heavy message broker
- Typed event map is the key value-add vs raw EventEmitter
- `SignalBridge` export for connecting two bus instances (e.g. worker → client)
- v1 is in-process only; external pub/sub (Redis, Cloudflare Queues) is a future extension

---

### `@uvrn/timeline` — Time-Series Query Layer

**Layer:** 3 — Temporal & Lifecycle
**Priority:** Medium-high

**What it does:** Reconstructs the full consensus history of any claim. Queries any compatible store to return a time-ordered sequence of receipts and drift snapshots. Canon events are annotated as landmarks. Storage is pluggable — implement `TimelineStore` to point it at any data source.

**Design philosophy:** `@uvrn/timeline` is a query layer, not a storage layer. It defines `TimelineStore` (a simple two-method interface) and handles the time-series logic — sampling, resolution, charting, summary generation. You connect it to whatever storage you use.

**Public API sketch:**
```ts
import { Timeline } from '@uvrn/timeline';

// Bring your own store — implement TimelineStore interface
const timeline = new Timeline({ store: myStore });

const history = await timeline.query('clm_sol_001', {
  from: '2026-01-01',
  to:   '2026-03-29',
  resolution: 'daily',
});

// history.snapshots → DriftSnapshot[]
// history.canonEvents → CanonReceipt[]
// history.chart() → { labels, vScores, statuses, canonMarkers }
// history.summary → LLM-friendly narrative
```

**Dependencies:** `@uvrn/core`, `@uvrn/drift`, `@uvrn/canon`

**Interface contracts:**
- `TimelineStore` — implement to use any storage backend:
  ```ts
  interface TimelineStore {
    getSnapshots(claimId: string, from: number, to: number): Promise<DriftSnapshot[]>;
    getCanonEvents(claimId: string, from: number, to: number): Promise<CanonReceipt[]>;
  }
  ```
- `resolution` param: `'hourly' | 'daily' | 'weekly'`
- Canon events annotated as landmarks on the timeline
- `chart()` returns chart.js / recharts compatible data
- Optional `apiUrl` param to query the hosted worker API instead of a local store

---

### `@uvrn/score` — V-Score Composition & Profiles

**Layer:** 2 — Receipt & Verification
**Priority:** Medium

**What it does:** Exposes V-Score composition internals so developers can reason about *why* a score is what it is. Provides domain-specific scoring profiles with weights tuned for financial, medical, legal, and research claim types.

**Public API sketch:**
```ts
import { ScoreBreakdown, ScoringProfile, SCORE_PROFILES } from '@uvrn/score';

const breakdown = new ScoreBreakdown(receipt, SCORE_PROFILES.financial);

breakdown.completeness   // { raw: 88, weight: 0.35, weighted: 30.8 }
breakdown.parity         // { raw: 92, weight: 0.35, weighted: 32.2 }
breakdown.freshness      // { raw: 75, weight: 0.30, weighted: 22.5 }
breakdown.final          // 85.5
breakdown.explanation    // human-readable + LLM-friendly string
```

**Dependencies:** `@uvrn/core`

**Interface contracts:**
- The canonical weight formula (0.35 / 0.35 / 0.30) lives in `@uvrn/core` — this package must not redefine it, only expose and decompose it
- Domain profiles explain weights for a claim type — they do not change the formula
- `explanation` string must be LLM-friendly (short, factual)

---

### `@uvrn/compare` — Cross-Receipt Comparison

**Layer:** 2 — Receipt & Verification
**Priority:** Medium

**What it does:** Detects competing claims and tracks how consensus shifts across receipt versions. Answers questions like "how does consensus for Claim A compare to Claim B over time?"

**Public API sketch:**
```ts
import { CompareEngine } from '@uvrn/compare';

const result = CompareEngine.compare([receiptA, receiptB], {
  normalize: true,
  includeTimeline: true,
});

// result.winner         → receiptA (higher consensus)
// result.delta          → 12.4 points
// result.divergenceAt   → '2026-02-15T10:00Z'
// result.summary        → human-readable + LLM-friendly explanation
```

**Dependencies:** `@uvrn/core`, `@uvrn/drift`, `@uvrn/timeline` (optional)

**Interface contracts:**
- The comparison unit is the *claim*, not the receipt — multiple receipts for the same claim form a series
- v1: simple score comparison + delta; later: full divergence detection and causality analysis
- `summary` field must be LLM-friendly

---

### `@uvrn/identity` — Signer Reputation Layer

**Layer:** 2 — Receipt & Verification
**Priority:** Lower (important long-term for trust infrastructure)

**What it does:** Signer reputation layer. High-reputation signers carry higher baseline trust based on track record. Lets consumers weight receipts by issuer credibility. Storage is pluggable — implement `IdentityStore` to use any backend.

**Design philosophy:** Reputation logic (the scoring formula, level thresholds, activity tracking) is owned by `@uvrn/identity`. Where that data is stored is up to you. A `MockIdentityStore` is included for testing. For production, implement `IdentityStore` with your preferred backend (SQL, Supabase, KV store, on-chain, etc.).

**Public API sketch:**
```ts
import { IdentityRegistry } from '@uvrn/identity';

// Bring your own store — implement IdentityStore interface
const registry = new IdentityRegistry({ store: myStore });

const rep = await registry.reputation('0xA9F1...');
// rep.score     → 94 (0–100)
// rep.receipts  → 1847
// rep.accuracy  → 0.91 (fraction that matched consensus)
// rep.since     → '2025-08-01'
// rep.level     → 'trusted' | 'established' | 'new' | 'unknown'
```

**Dependencies:** `@uvrn/core`, `@uvrn/adapter` (for signer address)

**Interface contracts:**
- `IdentityStore` — implement to use any storage backend:
  ```ts
  interface IdentityStore {
    getReputation(address: string): Promise<ReputationScore | null>;
    saveReputation(rep: ReputationScore): Promise<void>;
    recordActivity(activity: ReputationActivity): Promise<void>;
    listLeaderboard(limit: number): Promise<ReputationScore[]>;
  }
  ```
- Reputation derived from protocol-verifiable facts only: receipt count, canon rate, V-Score accuracy
- `MockIdentityStore` (in-memory) included for testing
- v1 is purely additive (scores only go up); later versions can introduce decay for stale signers
- Privacy consideration: signer addresses are public, but behavioral profile aggregation creates deanonymization risk — be intentional about what the registry exposes

---

### `@uvrn/test` — Testing Utilities & Mocks

**Layer:** 2 — Receipt & Verification
**Priority:** Medium

**What it does:** Centralized mocks, fixtures, and factory functions for building on UVRN without live infrastructure. Replaces scattered mock implementations across individual packages.

**Public API sketch:**
```ts
import {
  mockReceipt,
  mockDriftSnapshot,
  mockCanonReceipt,
  MockFarmConnector,
  MockStore,
  MockSigner,
  fixtures,
} from '@uvrn/test';

const receipt = mockReceipt({ v_score: 88, status: 'STABLE' });
const canon   = mockCanonReceipt({ claimId: 'clm_001' });
const farm    = new MockFarmConnector({ latencyMs: 50 });
```

**Dependencies:** `@uvrn/core`, `@uvrn/drift`, `@uvrn/canon` (peer deps — devDependency in consumers)

**Interface contracts:**
- This package should be a `devDependency` — never a runtime dep
- Factory functions accept partial overrides (like `@testing-library` patterns)
- Consumers should never need to build full receipt objects by hand

---

### `@uvrn/watch` — Subscription & Threshold Alerts

**Layer:** 4 — Distribution & Access
**Priority:** Medium

**What it does:** Subscription API for registering threshold alerts on claims. Triggers callbacks or webhooks when drift crosses a boundary. Wraps `@uvrn/agent`'s threshold events and adds delivery routing, deduplication, cooldown logic, and pluggable delivery targets.

**Design philosophy:** `@uvrn/watch` manages *when* to alert (threshold detection, cooldown, deduplication) and *how* to route it (the delivery interface). It ships with a small set of reference delivery implementations. You can use them, replace them, or add your own — the delivery system is pluggable. The in-process `callback` target works with zero external dependencies.

**Public API sketch:**
```ts
import { Watcher } from '@uvrn/watch';

const watcher = new Watcher({ agent });

// In-process callback — zero dependencies
watcher.subscribe('clm_sol_001', {
  on: 'CRITICAL',
  notify: { callback: (event) => console.log('Alert:', event) },
  mode: 'once',
  cooldown: 300_000,
});

// Reference delivery targets (plug in as needed)
watcher.subscribe('clm_sol_001', {
  on: ['DRIFTING', 'CRITICAL'],
  notify: {
    webhook: 'https://my-app.com/alerts',   // any HTTP endpoint
    slack: 'https://hooks.slack.com/...',   // Slack incoming webhook URL
    discord: 'https://discord.com/api/webhooks/...',
  },
});
```

**Dependencies:** `@uvrn/agent`, `@uvrn/drift`

**Interface contracts:**
- `NotifyTarget` — pluggable delivery interface; add custom targets by implementing it
- Built-in delivery targets: `callback` (in-process), `WebhookDelivery` (any HTTP endpoint), `SlackDelivery`, `DiscordDelivery` — all optional, all replaceable
- Must support `'once'` vs `'every'` alert modes
- Cooldown logic prevents alert floods on DRIFTING claims
- No external service is required to use `@uvrn/watch` — `callback` delivery works standalone

---

### `@uvrn/embed` — Embeddable Consensus Badges

**Layer:** 4 — Distribution & Access
**Priority:** Medium

**What it does:** Drop-in React component and plain JS UMD script showing live consensus status on any webpage. Think GitHub build badge, but for UVRN claim consensus. Points at any UVRN-compatible API endpoint — self-hosted or `api.uvrn.org`.

**Design philosophy:** `@uvrn/embed` is pure UI. It fetches badge data from whatever `apiUrl` you configure, renders status and score, and handles caching and error states. The React component and UMD builds are independent — use one or both. The UMD script has zero dependencies and works on any webpage.

**Public API sketch (React):**
```tsx
import { ConsensusBadge } from '@uvrn/embed';

<ConsensusBadge
  claimId="clm_sol_001"
  apiUrl="https://your-api.example.com"  // any UVRN-compatible endpoint
  theme="dark"
  showScore={true}
  showStatus={true}
/>
// Renders: 🟢 STABLE  V-Score: 91
```

**Plain JS (no React, no build tools):**
```html
<script src="path/to/embed.umd.js"></script>
<div data-uvrn-claim="clm_sol_001" data-uvrn-api="https://your-api.example.com"></div>
<!-- Auto-initializes on DOMContentLoaded -->
```

**Dependencies:** `@uvrn/core` (types only — peer dep). React is an optional peer dep — UMD build requires neither.

**Interface contracts:**
- Bundle as both ESM React component (`dist/index.js`) and standalone UMD script (`dist/embed.umd.js`)
- UMD build has zero runtime dependencies — works on any webpage without a bundler
- `apiUrl` is configurable — point at self-hosted `@uvrn/api`, the hosted `api.uvrn.org`, or any compatible endpoint
- In-memory 60-second cache — no localStorage, no cookies
- Color scheme: green (STABLE), amber (DRIFTING), red (CRITICAL)

---

## Full Package Status

| Package | Layer | Status | Role |
|---------|-------|--------|------|
| `@uvrn/core` | 2 | Live (npm) | Deterministic delta engine — V-Score math, validation, DRVC3 receipts |
| `@uvrn/sdk` | 2 | Live (npm) | TypeScript SDK — submit claims, read receipts |
| `@uvrn/adapter` | 2 | Live (npm) | DRVC3 envelope adapter — EIP-191 signatures |
| `@uvrn/mcp` | 4 | Live (npm) | MCP server — AI agent native access |
| `@uvrn/api` | 4 | Live (npm) | Fastify REST API — self-hosted deployments |
| `@uvrn/cli` | 4 | Live (npm) | CLI — `uvrn run bundle.json` → receipt |
| `@uvrn/drift` | 3 | Pre-release | Temporal decay scoring |
| `@uvrn/agent` | 3 | Pre-release | Continuous claim monitoring loop |
| `@uvrn/canon` | 3 | Pre-release | Canonization engine — permanent signed records |
| `@uvrn/farm` | 1 | Roadmap | Data source connectors |
| `@uvrn/consensus` | 1 | Roadmap | Multi-source signal aggregation |
| `@uvrn/normalize` | 1 | Roadmap | Source normalization layer |
| `@uvrn/signal` | 1 | Roadmap | Internal event bus |
| `@uvrn/timeline` | 3 | Roadmap | Time-series query layer |
| `@uvrn/score` | 2 | Roadmap | V-Score composition & profiles |
| `@uvrn/compare` | 2 | Roadmap | Cross-receipt comparison |
| `@uvrn/identity` | 2 | Roadmap | Signer reputation layer |
| `@uvrn/test` | 2 | Roadmap | Testing utilities & mocks |
| `@uvrn/watch` | 4 | Roadmap | Subscription & threshold alerts |
| `@uvrn/embed` | 4 | Roadmap | Embeddable consensus badges |

---

## Publish Order (Full 20-Package Sequence)

1. `@uvrn/core` → 2. `@uvrn/drift` → 3. `@uvrn/sdk` → 4. `@uvrn/adapter` → 5. `@uvrn/canon` → 6. `@uvrn/agent` → 7. `@uvrn/farm` → 8. `@uvrn/normalize` → 9. `@uvrn/consensus` → 10. `@uvrn/signal` → 11. `@uvrn/score` → 12. `@uvrn/compare` → 13. `@uvrn/identity` → 14. `@uvrn/test` → 15. `@uvrn/timeline` → 16. `@uvrn/mcp` → 17. `@uvrn/api` → 18. `@uvrn/cli` → 19. `@uvrn/watch` → 20. `@uvrn/embed`

---

*UVRN is an open protocol. These specs are public so anyone can build compatible implementations. The official packages will ship on their own timeline — but the protocol doesn't have to wait.*

*MIT License — [UVRN-org](https://github.com/UVRN-org)*
