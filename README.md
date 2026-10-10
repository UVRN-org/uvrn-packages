# UVRN — Universal Verification Receipt Network

Monorepo of `@uvrn/*` protocol packages for measuring and proving the relationship state of evidence about a claim. Publish is **Admin-gated** (see [`PUBLISH.md`](PUBLISH.md)).

UVRN measures whether independent evidence **agrees, disagrees, conflicts, or shows early potential** about a claim — and makes that measurement **provable** to anyone, human or machine.

**This repository** ([`UVRN-org/uvrn-packages`](https://github.com/UVRN-org/uvrn-packages)) is the **public Apache-2.0 implementation monorepo** — **34** workspace packages under `@uvrn/*` (pnpm workspaces): 33 at **`5.1.x`** plus `@uvrn/probability` at **`0.3.x`**.

**Org / protocol home**: [`UVRN-org/uvrn`](https://github.com/UVRN-org/uvrn)

| Set | Scope | Count | Version |
|-----|-------|-------|---------|
| Public spine + advancements | `@uvrn/*` | 33 | `5.1.0`; `cli`, `mcp`, `track-record`, `store-sqlite` → `5.1.1` |
| Probability layer | `@uvrn/probability` | 1 | `0.3.1` |


**Public advancements (Apache-2.0):** `@uvrn/visual`, `@uvrn/chart-memory` @ `5.1.0`; `@uvrn/track-record` @ `5.1.1`.


Public consumers use `@uvrn/*` only (including `@uvrn/store-sqlite` main). `@uvrn/store-sqlite/track-record` subpath peers `@uvrn/track-record`. Existing v3 receipts and `verifyReceipt()` remain byte-for-byte valid (additive-only rule, golden-vector enforced). See [`CHANGELOG.md`](CHANGELOG.md).

**Agent context (in-repo coding)**: `AGENTS.md` (Cursor/Codex) | `CLAUDE.md` (Claude Code)  
**External MCP agents**: [`uvrn-mcp/CONNECT.md`](uvrn-mcp/CONNECT.md) — preferred connect path  
**Protocol contracts of record**: [`SPEC/`](SPEC/) (receipt hashing, signing, measurement semantics, network API)  
**Package interface specs**: `ROADMAP.md`


---

## Connect an AI agent (MCP-first)

Prefer **MCP over stdio**. No API keys and no database on the default path.

```bash
npx -y @uvrn/mcp
```

Full connector recipes (Claude Desktop, Cursor, Claude Code, Hermes, Odysseus, generic):
**[`uvrn-mcp/CONNECT.md`](uvrn-mcp/CONNECT.md)**. Ready-to-copy profiles live in
[`uvrn-mcp/connectors/`](uvrn-mcp/connectors/) (server key `uvrn`).

Minimal Cursor / Claude Desktop shape:

```json
{
  "mcpServers": {
    "uvrn": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"],
      "env": { "LOG_LEVEL": "info" }
    }
  }
}
```

**What you get:** 14 tools — `delta_run_engine`, `delta_validate_bundle`, `delta_verify_receipt`,
`delta_score_drift`, `delta_compare`, `delta_verify_identity`, `delta_canon_qualify`,
`delta_canon_get`, `delta_score_claim`, `delta_read_support`, `delta_report_rank_stability`,
`delta_validate_datapoint`, `delta_pattern_scan`, `delta_prob_run` — plus resources and prompts. Machine-readable contract:
[`uvrn-mcp/plugin-manifest.json`](uvrn-mcp/plugin-manifest.json). Full list: [`uvrn-mcp/CONNECT.md`](uvrn-mcp/CONNECT.md).

**Honesty walls (agents):**

- Integrity-checked ≠ verified (verification needs a checked producer signature).
- `insufficient-data` is a successful honest outcome — not a failure to guess.
- Gaps and missing origins are recorded; do not invent corroboration.
- Possible reasons and diagnostics are not verdicts.

**Not MCP tools:** post-pipeline readout library surfaces (`@uvrn/algox` rank-stability, `@uvrn/lattice`
`readSupport`, `@uvrn/consensus` `reportSpread`) are package APIs for hosts — they are **not**
additional MCP tool names unless later exposed in the manifest.

**Transport note:** “Online” here means the **published npm package over stdio**. There is **no
hosted remote MCP URL** today. For HTTP, use `@uvrn/api` (REST) instead.

Fallbacks: SDK (`@uvrn/sdk`), REST (`@uvrn/api`), CLI (`@uvrn/cli`) — see access layers below.

### Agent guides

How-to for agents (not hash law) lives in [`agents/`](agents/):

- [`agents/SCRIBE.md`](agents/SCRIBE.md) — dual-source read (worker receipt book + article JSON)
- [`agents/README.md`](agents/README.md) — index and dual-scope note (views/charts/track-record are public `@uvrn/*`; archive/D1/QA remain restricted)

Root [`AGENTS.md`](AGENTS.md) is binding law; `agents/` is how-to.


---

## What UVRN measures

UVRN's job is **not** "produce a receipt." A receipt is the *output*. UVRN's job is to measure the **relationship state of evidence** about a claim — whether independent sources line up, diverge, contradict, or are starting to move together — and to make that measurement verifiable.

A receipt is a **snapshot** of that relationship at a point in time, plus the proof. The value is the measurement and the proof, not the document.

This is the function the whole protocol is organized around. Everything else — data connectors, scoring internals, temporal decay, alerts, badges — feeds or consumes this measurement.

---

## The four measurements

The starter relationship vocabulary is a set of **first-class, modular measurements**. Each is its own module implementing a shared `Measurement` contract, so a host can add, edit, or swap them without touching the engine.

| Measurement | Meaning |
|---|---|
| **Agree** | Independent sources line up / converge within tolerance. |
| **Disagree** | Sources diverge — they point in materially different directions. |
| **Conflict** | Sources directly contradict — mutually exclusive values or disjoint ranges. |
| **Potential** | An emerging, unsettled signal — agreement is rising but not yet resolved; worth watching. |

The vocabulary is **open**. Adopters may define additional measurement types (e.g. *partial*, *stale*, *unverifiable*) by implementing the same contract. The four above are the official starters, not a closed set.

Since v4 the starters are **decision-complete** — `SPEC/uvrn-measurement-v1.md` locks the exact rules (when conflict fires, what potential requires) — and every starter emits the honest `insufficient-data` verdict when evidence is too thin to measure, never a guess.

- The **contract** (the `Measurement` type) lives in `@uvrn/core` — additive type surface only, it does not touch the live hash/verify path.
- The **logic** lives in `@uvrn/measure` — four pluggable modules plus a registry. Host-owned, swappable, no fork required.

---

## The master receipt

Measurements roll up into a single verifiable **master receipt** — an additive envelope over the existing `DeltaReceipt`. One structure accumulates:

1. **Every source** that fed the claim.
2. **Every measurement result** that ran (agree / disagree / conflict / potential + any custom).
3. **Node status** for each participating source — **on / off / unavailable**. If a node was down, the receipt says so. Gaps are **recorded, not hidden.**

**Hard constraint — core is live.** The master receipt is **additive only**. The base receipt's canonical hashing and `verifyReceipt()` are byte-for-byte unchanged; existing receipts stay valid and re-checkable. The master envelope carries its own hash — since v4 over a spec-exact payload with canonical ordering (`SPEC/uvrn-receipt-v1.md` §2.2) — so the aggregate, including an honest record of what was missing or down, is independently *integrity-checked*; wrap it in a signed NetworkReceipt (`@uvrn/receipt`) and it becomes *verifiable*.

---

## Quick example

Run the engine, measure the relationship, aggregate into one verifiable master receipt:

```ts
import { defaultRegistry } from '@uvrn/measure';
import { buildMasterReceipt, verifyMasterReceipt, runDeltaEngine } from '@uvrn/core';

// 1. Base delta engine runs as before — receipt stays independently integrity-checkable.
const base = runDeltaEngine(bundle);

// 2. Run UVRN's four starter measurements over the same evidence.
const registry = defaultRegistry(); // agree, disagree, conflict, potential
const measurements = registry.runAll({
  claim: 'BTC above 100k by EOY',
  sources: [
    { id: 'src-a', kind: 'numeric', value: 0.82, status: 'on' },
    { id: 'src-b', kind: 'numeric', value: 0.80, status: 'on' },
    { id: 'src-c', kind: 'numeric', value: 0.10, status: 'off' },
  ],
});

// 3. Aggregate into one verifiable master receipt — node status recorded, not hidden.
const master = buildMasterReceipt({
  base,
  measurements,
  nodes: [
    { id: 'src-a', status: 'on' },
    { id: 'src-b', status: 'on' },
    { id: 'src-c', status: 'off', detail: 'fetch timeout' },
  ],
});

verifyMasterReceipt(master).verified; // true — base hash + master envelope both recompute (integrity-checked; no signature involved)
```

Register a custom measurement at any time — `registry.register(myMeasurement)` adds it; `registry.unregister('agree')` removes a starter. The same claim → MasterReceipt pipeline is reachable from an AI agent via the `delta_score_claim` MCP tool (claim in → MasterReceipt out).

---

## V-Score

Where a single composite score is needed, UVRN uses the V-Score (defined once, in `@uvrn/core`, never redefined):

```
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

The weights live **only** in `@uvrn/core` (exported as `VSCORE_WEIGHTS`). `@uvrn/score` re-exports them as `WEIGHTS` and decomposes them into a breakdown — a passthrough, not a second definition. No package copies or redefines them.

---

## Design philosophy

UVRN is **provider-agnostic and agent-connectable by design**. Every package is built around its *interface contract*, not around any specific third-party service, vendor, or stack.

- Packages that touch external systems define a **pluggable interface** — you implement it with whatever provider you use.
- **Reference implementations** using free/open APIs ship as working examples — not locked-in defaults.
- **The in-process / zero-external path always works** — run the full protocol locally with no external service signups, on any machine.
- **Interfaces are the protocol; implementations are examples** — clearly documented so you know what to own and what to swap.
- **No system-specific default.** Nothing assumes a particular OS, vendor, data provider, or agent client. Protocol surfaces (especially MCP) advertise a discoverable contract any agent can self-configure against.

This is what makes UVRN usable across any stack: a DeFi monitor, a newsroom fact-checker, a research-integrity tool, a custom enterprise pipeline — all on the same protocol, all bringing their own providers.

---

## Access layers

The measurement function has several front doors. They are access layers onto the same protocol, not the architecture itself.

| Layer | Package | Use it for |
|---|---|---|
| SDK | `@uvrn/sdk` | Programmatic access (CLI / HTTP / local modes), bundle builders, validators. |
| API | `@uvrn/api` | Self-hosted Fastify REST endpoints. |
| CLI | `@uvrn/cli` | `uvrn run bundle.json` → receipt; `uvrn prob run` → receipted probability. |
| MCP | `@uvrn/mcp` | AI-agent native access — **14 stateless tools** over stdio. |
| Embed | `@uvrn/embed` | Live-status badge for any webpage (React or plain HTML). |

**Expanded MCP surface** — `@uvrn/mcp` exposes **14 tools**: `delta_run_engine`, `delta_validate_bundle`, `delta_verify_receipt`, `delta_score_drift`, `delta_compare`, `delta_verify_identity`, `delta_canon_qualify`, `delta_canon_get`, `delta_score_claim`, `delta_read_support`, `delta_report_rank_stability`, `delta_validate_datapoint`, `delta_pattern_scan`, and `delta_prob_run` (a receipted probability from cited inputs via `@uvrn/probability` — never a V-Score). `delta_score_claim` resolves evidence from one of three paths, in precedence order: **host-provided `sources`** — an agent that can search the web supplies 2+ sources directly, each with an optional `evidenceScore` (0–100) and `credibility` (0–1); a **configured connector**; or **mock** data as the zero-external fallback. Host `evidenceScore` is carried as a first-class numeric field (never string-encoded), so a number in a source title can never override the intended score. The server takes **runtime config injection** via `createServer(runtimeConfig?)` — connectors come from config, never hardcoded vendor defaults — and ships a client-neutral `plugin-manifest.json` for discovery. stdio is the zero-config transport; any MCP-compatible agent connects with no fork.

**Tools are a surface, not the system.** The 14 MCP tools expose a *subset* of the protocol — they route into the engine packages (`core`, `drift`, `compare`, `consensus`, `normalize`, `measure`, `canon`, `identity`) plus the `FarmConnector` data-fetch contract used by `delta_score_claim`. The packages that **don't** appear as tools are not missing features: some are alternative front doors (`sdk`, `api`, `cli`, `embed`), some are foundation layers (`signal`, `score`, `lattice`), some are reference implementations of pluggable seams (`farm` connectors, `watch` delivery, the `*Store` backends including `timeline` storage/query) you replace rather than call, and the rest are supporting packages (`adapter` signing, `algox` ranking, `test` harness). The pipeline *shape* is fixed; the *edges* — where data enters, where state persists, where alerts exit — are interfaces you implement. Maintainers can change anything in-tree, but by design hosts rarely need to fork: you plug into named contracts. See [Design philosophy](#design-philosophy) and [Package independence](#package-independence).

---

## Full package status

| Package | Layer | Status | Description |
|---------|-------|--------|-------------|
| `@uvrn/core` | 2 | ✅ Live (5.1) | Delta engine — V-Score math, validation, DRVC3 receipts, **Measurement contract + master receipt** |
| `@uvrn/sdk` | 2 | ✅ Live (5.1) | TypeScript SDK — submit claims, read receipts |
| `@uvrn/adapter` | 2 | ✅ Live (5.1) | DRVC3 envelope adapter — EIP-191 signatures |
| `@uvrn/mcp` | 4 | ✅ Live (5.1) | MCP server — 14 stateless tools, AI-agent native access |
| `@uvrn/api` | 4 | ✅ Live (5.1) | Fastify REST API — self-hosted deployments |
| `@uvrn/cli` | 4 | ✅ Live (5.1) | CLI — `uvrn run bundle.json` → receipt; `uvrn prob run` → receipted probability |
| `@uvrn/drift` | 3 | ✅ Live (5.1) | Temporal decay scoring |
| `@uvrn/agent` | 3 | ✅ Live (5.1) | Continuous claim monitoring loop |
| `@uvrn/canon` | 3 | ✅ Live (5.1) | Canonization engine — permanent signed records |
| `@uvrn/signal` | 1 | ✅ Live (5.1) | Typed internal event bus — zero deps |
| `@uvrn/score` | 2 | ✅ Live (5.1) | V-Score breakdown + domain profiles (re-exports core's `VSCORE_WEIGHTS`) |
| `@uvrn/test` | 2 | ✅ Live (5.1) | Mocks, fixtures, factory functions |
| `@uvrn/farm` | 1 | ✅ Live (5.1) | Data source connectors (news, financial, on-chain) |
| `@uvrn/normalize` | 1 | ✅ Live (5.1) | Source normalization layer |
| `@uvrn/lattice` | 1 | ✅ Live (5.1) | Cross-domain question decomposition |
| `@uvrn/consensus` | 1 | ✅ Live (5.1) | Multi-source signal aggregation |
| `@uvrn/compare` | 2 | ✅ Live (5.1) | Cross-receipt comparison |
| `@uvrn/measure` | 2 | ✅ Live (5.1) | Pluggable agree/disagree/conflict/potential measurements + registry |
| `@uvrn/identity` | 2 | ✅ Live (5.1) | Signer reputation layer |
| `@uvrn/timeline` | 3 | ✅ Live (5.1) | Time-series query layer |
| `@uvrn/algox` | 3 | ✅ Live (5.1) | Signal ranking and selection |
| `@uvrn/watch` | 4 | ✅ Live (5.1) | Subscription & threshold alerts — `WatchStore` seam, delivery retry |
| `@uvrn/embed` | 4 | ✅ Live (5.1) | Embeddable React badge + UMD script |
| `@uvrn/receipt` | 2 | ✅ Live (5.1) | **The canonical receipt object model** — NetworkReceipt envelope, JCS canonicalization (single ecosystem implementation), Ed25519 signing, topics, Layer D vocabulary, `toHumanView()` |
| `@uvrn/store-sqlite` | 3 | ✅ Live (5.1) | Every store interface against one local SQLite file + `pushToNetwork()` — main entry public; `/track-record` subpath peers `@uvrn/track-record@^5.1.0` |
| `@uvrn/protocol` | — | ✅ Live (5.1) | Single-install production umbrella: core + receipt + measure + consensus + normalize + score + algox + signal |
| `@uvrn/visual` | 4 | ✅ Live (5.1) | Plain-default receipt → HTML/SVG views (picture is never the proof) |
| `@uvrn/chart-memory` | 4 | ✅ Live (5.1) | Plain-default history → SVG/HTML time charts (picture is never the proof) |
| `@uvrn/jsonld` | 2 | ✅ Live (5.1) | Offline JSON-LD projection of receipts (never a hash input) |
| `@uvrn/track-record` | 3 | ✅ Live (5.1) | Per-origin track records — transcription, revisions, Brier-scored forecasts, forecast log + multi-class Brier |
| `@uvrn/meta-readout` | 4 | ✅ Live (5.1) | HumanView → MetaReadout facts bag (soft-go context; not buy/rank law) |
| `@uvrn/pattern` | 3 | ✅ Live (5.1) | PatternObservations over history — detected ≠ verified; not receipt-class |
| `@uvrn/validate` | 2 | ✅ Live (5.1) | DataPoint shape check + optional Stage2 measure route (never emits `verified`) |
| `@uvrn/probability` | 3 | ✅ Live (0.3.1) | Deterministic, receipted forecasts — market, base-rate, or attributed-judgment mode; v1/v2/v3 contracts (v3: fixed-offset local deadlines); refuses rather than guesses; thresholds PROVISIONAL |

*Public `@uvrn/*` packages: **34** (33 at `5.1.x` plus `@uvrn/probability` `0.3.1`).*


---

## Protocol layer model

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4 — Distribution & Access                                │
│  @uvrn/embed  @uvrn/watch  @uvrn/mcp  @uvrn/api  @uvrn/cli    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — Temporal & Lifecycle                                 │
│  @uvrn/drift  @uvrn/agent  @uvrn/canon  @uvrn/timeline  @uvrn/algox │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — Receipt, Measurement & Verification                  │
│  @uvrn/core  @uvrn/sdk  @uvrn/adapter  @uvrn/score             │
│  @uvrn/compare  @uvrn/measure  @uvrn/identity  @uvrn/test      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1 — Data & Consensus                                     │
│  @uvrn/farm  @uvrn/consensus  @uvrn/normalize  @uvrn/lattice  @uvrn/signal │
└─────────────────────────────────────────────────────────────────┘
```

---

## Package independence

Every package is **independently installable**. You do not need the full protocol to use a single package. Each README documents the minimum install required.

Packages that touch external systems — or that carry swappable logic — expose pluggable extension points. Bring your own:

| Package | Extension point | What you bring |
|---------|----------------|----|
| `@uvrn/measure` | `MeasurementRegistry` | Custom relationship modules — `register()` / `unregister()` over the `Measurement` contract |
| `@uvrn/farm` | `FarmConnector` | Any data source — API, feed, scraper, custom |
| `@uvrn/canon` | `CanonStore` | Any storage backend — SQL, KV, IPFS, cloud |
| `@uvrn/identity` | `IdentityStore` | Any storage backend |
| `@uvrn/timeline` | `TimelineStore` | Any storage backend |
| `@uvrn/watch` | `NotifyTarget` | Any delivery channel — webhook, callback, custom |
| `@uvrn/embed` | `apiUrl` config | Any UVRN-compatible API endpoint |

Reference implementations for common providers ship in each package as working examples.

---

## Install & build

```bash
pnpm install
pnpm run build
pnpm run test
```

---

## Structure

```
uvrn-packages/
├── SPEC/                       ← normative protocol specifications (hashing, signing, measurement, network)
├── AGENTS.md                   ← Cursor/Codex agent context (read this)
├── CLAUDE.md                   ← Claude Code context (read this)
├── agents/                     ← agent how-to (SCRIBE, dual-scope notes; not hash law)
├── uvrn-core/     uvrn-sdk/   uvrn-adapter/
├── uvrn-mcp/      uvrn-api/   uvrn-cli/
├── uvrn-drift/    uvrn-agent/ uvrn-canon/
├── uvrn-signal/   uvrn-score/ uvrn-test/
├── uvrn-farm/     uvrn-normalize/ uvrn-lattice/
├── uvrn-consensus/ uvrn-compare/ uvrn-measure/ uvrn-identity/ uvrn-timeline/
├── uvrn-watch/    uvrn-embed/
├── uvrn-receipt/  uvrn-store-sqlite/ uvrn-protocol/
├── uvrn-visual/   uvrn-chart-memory/
├── uvrn-jsonld/   uvrn-track-record/ uvrn-validate/ uvrn-meta-readout/ uvrn-pattern/
└── uvrn-probability/
```

---

## Publish order

Publish is owner-gated — see [`PUBLISH.md`](PUBLISH.md) for the full order and rules.

**5.1 release:** all 34 public packages publish together on the 5.1 line — 33 at `5.1.x` and
`@uvrn/probability` at `0.3.x` — core first, `@uvrn/visual` last, so the registry carries the public
repository URL and the release-test fixes. The exact dependency order is in
[`PUBLISH.md`](PUBLISH.md); only `pnpm publish` is allowed (a `prepublishOnly` guard refuses `npm publish`).


---

## Reference

- **Protocol contracts**: [`SPEC/`](SPEC/) — receipt hash contract, Ed25519 signing, measurement semantics, network API, golden vectors
- **Full package specs**: `ROADMAP.md` (canonical spec — interface contracts and design notes for all packages)
- **Design philosophy**: "Provider-Agnostic by Design" in `ROADMAP.md` and `AGENTS.md`
- Internal architecture, build-plan, and audit documents are maintained in the maintainers' private workspace, not in this repository.


**Disclaimer:** UVRN is in Alpha. The protocol measures the **relationship between your sources** — whether they agree, disagree, conflict, or show potential — not whether any source is correct. Final trust of any output rests with the user.

## License

Every `@uvrn/*` package is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

- **Use it freely**: commercial use, changes and redistribution are all allowed.
- **Keep the credit**: if you redistribute UVRN or a work derived from it, carry the NOTICE attribution ("Built on UVRN").
- **The name stays ours**: the license grants no rights to the UVRN name or brand beyond describing where the work came from.

Copyright 2025-2026 Suttle Media / UVRN-org
