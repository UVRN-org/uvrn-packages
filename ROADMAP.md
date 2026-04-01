# UVRN Package Roadmap — Open Protocol Specs

**Status:** Active — updated as packages ship
**Last updated:** 2026-03-30

> This document contains the full technical specifications for every upcoming UVRN package. Each spec includes the package intent, public API sketch, dependency requirements, interface contracts, and authoring notes — enough detail to serve as a seed for building a compatible implementation against the UVRN protocol.
>
> **Use this however you want.** Hand a package spec to an AI agent, build it yourself, or use it as a reference for how the protocol fits together. The only rule: implementations that want to interoperate with the official UVRN ecosystem must match the interface contracts defined here.

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

**What it does:** Locks a receipt as a permanent, human-confirmed, signed canonical record. Auto-suggests candidates for canonization but never auto-canonizes — a human or explicitly confirmed system trigger must call `canonize()`. Stores to R2, Supabase, or IPFS.

**Public API sketch:**
```ts
import { Canon, CanonStore } from '@uvrn/canon';

const canon = new Canon({
  store: new CanonStore.Supabase({ url, key }),
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
- `CanonStore` interface — storage backends must implement:
  ```ts
  interface CanonStore {
    save(record: CanonReceipt): Promise<string>;    // returns storage ID
    get(id: string): Promise<CanonReceipt | null>;
    list(claimId: string): Promise<CanonReceipt[]>;
  }
  ```
- Built-in store implementations: `CanonStore.Supabase`, `CanonStore.R2`, `CanonStore.IPFS`
- **Critical design rule:** `canonize()` must always require explicit invocation. Never auto-canonize.

---

## Roadmap Packages

These packages are in the design phase. The specs below define the intended contract — build against them to create interoperable implementations.

---

### `@uvrn/farm` — Data Source Connectors

**Layer:** 1 — Data & Consensus
**Priority:** Highest — the missing input layer

**What it does:** Standardized connectors for ingesting external data sources — financial feeds, news, research, alt data. Implements the `FarmConnector` interface defined in `@uvrn/agent`. You plug a FarmConnector into Agent; `@uvrn/farm` provides the real-world connector implementations.

**Public API sketch:**
```ts
import { GoogleNewsFarm, PerplexityFarm, CoinGeckoFarm, MultiFarm } from '@uvrn/farm';

const farm = new MultiFarm([
  new GoogleNewsFarm({ apiKey: process.env.GOOGLE_API_KEY }),
  new PerplexityFarm({ apiKey: process.env.PERPLEXITY_KEY }),
  new CoinGeckoFarm(),  // free tier, no auth required
]);

// Drop into agent:
const agent = new Agent({ farmConnector: farm, receiptEmitter: emitter });
```

**Dependencies:** Implements `FarmConnector` interface from `@uvrn/agent`. Peer dep on `@uvrn/core` for receipt types.

**Interface contracts:**
- Each connector must implement `FarmConnector.fetch(claim): Promise<FarmResult>`
- `FarmResult` shape is defined in `@uvrn/agent` types
- `MultiFarm` fans out to all registered connectors in parallel, merges results
- Rate limiting and retry logic must be built into each connector, not delegated to caller

**v1.0 connector targets (free tier first):**
- Web/news/research: Parallel (multi-source deep research, free tier available)
- Broad market data: CoinGecko (free, no auth for basic price/market cap/volume)
- Exchange-level data: Coinbase Advanced Trade API (market data endpoints are free and public)
- Technical indicators: Twelve Data or Alpha Vantage (free tier for indicator feeds)

**Post-v1.0 candidates:** TradingView (upgrade path for indicators), Messari, The Block, arXiv, Semantic Scholar, Etherscan, Dune Analytics

**Authoring notes:**
- Each connector is independently swappable — upgrade individual connectors without touching others
- Consider implementing a connector registry pattern for discovery

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

**What it does:** Normalizes raw source data across providers so the delta engine can compare apples to apples. Different data sources return different formats, units, timestamps, and precision levels. This package standardizes them before they reach `@uvrn/consensus` or `@uvrn/core`.

**Public API sketch:**
```ts
import { normalize, NormalizationProfile } from '@uvrn/normalize';

const normalized = normalize(rawFarmResults, NormalizationProfile.financial);
// → Sources now share common schema: { value, unit, timestamp, credibility }
```

**Dependencies:** `@uvrn/core` (types), `@uvrn/farm` (optional peer)

**Interface contracts:**
- Normalization profiles mirror the DriftProfiles concept — pre-built configs for financial, research, news, on-chain domains
- Output schema must be stable and versioned — downstream packages must not break when new source types are added
- Each connector in `@uvrn/farm` can register its own normalizer (transformer pattern)

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

**What it does:** Reconstructs the full consensus history of any claim. Queries the receipt registry or local store to return a sequence of receipts and drift snapshots across time.

**Public API sketch:**
```ts
import { Timeline } from '@uvrn/timeline';

const timeline = new Timeline({ store: supabaseClient });

const history = await timeline.query('clm_sol_001', {
  from: '2026-01-01',
  to:   '2026-03-29',
  resolution: 'daily',
});

// history.snapshots → DriftSnapshot[]
// history.canonEvents → CanonReceipt[]
// history.chart() → { labels, vScores, statuses }
```

**Dependencies:** `@uvrn/core`, `@uvrn/drift`, `@uvrn/canon`

**Interface contracts:**
- Must work against both the hosted worker API (`api.uvrn.org`) and local stores
- `resolution` param: `'hourly' | 'daily' | 'weekly'`
- Canon events should be annotated as landmarks on the timeline
- `chart()` should return chart.js / recharts compatible data

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

**What it does:** Signer reputation layer. High-reputation signers carry higher baseline trust based on track record. Lets consumers weight receipts by issuer credibility.

**Public API sketch:**
```ts
import { IdentityRegistry, ReputationScore } from '@uvrn/identity';

const registry = new IdentityRegistry({ store: supabaseClient });

const rep = await registry.reputation('0xA9F1...');
// rep.score     → 94 (0–100)
// rep.receipts  → 1847
// rep.accuracy  → 0.91 (fraction that matched consensus)
// rep.since     → '2025-08-01'
```

**Dependencies:** `@uvrn/core`, `@uvrn/adapter` (for signer address)

**Interface contracts:**
- Reputation derived from on-chain verifiable facts: receipt count, canon rate, V-Score accuracy
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

**What it does:** Subscription API for registering threshold alerts on claims. Triggers callbacks or webhooks when drift crosses a boundary. The consumer-facing API layer for agent threshold events.

**Public API sketch:**
```ts
import { Watcher } from '@uvrn/watch';

const watcher = new Watcher({ agent, emitter: webhookEmitter });

watcher.subscribe('clm_sol_001', {
  on: 'CRITICAL',
  notify: { webhook: 'https://my-app.com/alerts', slack: '#trading-desk' },
});
```

**Dependencies:** `@uvrn/agent`, `@uvrn/drift`

**Interface contracts:**
- Consumer-facing wrapper around agent's `claim:threshold` events — adds routing, deduplication, and delivery
- Delivery targets v1.0: webhook, Slack, Discord, email (via SendGrid/Resend)
- Must support "alert once" vs "alert every crossing" modes
- Rate limiting / cooldown periods to prevent alert floods on DRIFTING claims

---

### `@uvrn/embed` — Embeddable Consensus Badges

**Layer:** 4 — Distribution & Access
**Priority:** Medium

**What it does:** Drop-in React component and plain JS snippet showing live consensus status on any webpage. Think GitHub build badge, but for UVRN claim consensus.

**Public API sketch (React):**
```tsx
import { ConsensusBadge } from '@uvrn/embed';

<ConsensusBadge
  claimId="clm_sol_001"
  apiUrl="https://api.uvrn.org"
  theme="dark"
  showScore={true}
  showStatus={true}
/>
// Renders: 🟢 STABLE  V-Score: 91
```

**Plain JS (no React):**
```html
<script src="https://cdn.uvrn.org/embed.js"></script>
<div data-uvrn-claim="clm_sol_001" data-uvrn-theme="dark"></div>
```

**Dependencies:** `@uvrn/core` (types only — peer dep)

**Interface contracts:**
- Bundle as both ESM React component and standalone UMD script
- UMD build is important — many embedding sites aren't React apps
- Cache badge data for 60 seconds to avoid hammering the API
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
