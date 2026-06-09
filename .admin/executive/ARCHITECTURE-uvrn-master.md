# UVRN Master Architecture — Function-First

**Status**: Architecture of record for the `feat/trend-engine-layer-v1` build
**Author**: Claude Cowork (research + planning)
**Date**: 2026-06-04
**Build standard**: Bloom Protocol v1.7
**Scope**: Defines the function-first model the official UVRN packages are organized around, and the
gap this build closes. Build plans under `.admin/build-plans/` implement it. MCP plans are side docs.

---

## 0. One-paragraph orientation

UVRN's job is **not** "produce a receipt." A receipt is the *output*. UVRN's job is to **measure the
relationship between evidence** about a claim — whether independent sources **agree**, **disagree**,
**conflict**, or show early **potential** — and to make that measurement provable to anyone, human or
machine. This document defines that function, names where it lives in the code today (one hardcoded
spot), and specifies how it becomes a set of modular, swappable measurements that roll up into a
single verifiable **master receipt** which also records the honest state of the network, including
**which nodes were live and which were offline**.

---

## 1. The function (not the output)

UVRN measures the **relationship state** of evidence about a claim. The four starter measurement
types are first-class, modular objects — they can be added to, edited, or removed without touching
the engine:

| Measurement | Meaning |
|---|---|
| **Agree** | Independent sources line up / converge within tolerance. |
| **Disagree** | Sources diverge — they point in materially different directions. |
| **Conflict** | Sources directly contradict — mutually exclusive claims. |
| **Potential** | An emerging or unsettled signal — not yet resolved, worth watching. |

Receipts are **snapshots** of this relationship state at a point in time. The protocol's value is the
measurement and the proof, not the document.

> **Design rule:** the measurement vocabulary is open. Adopters may define additional measurement
> types (e.g. *partial*, *stale*, *unverifiable*) by implementing the same contract. The four above
> are the official starters, not a closed set.

---

## 2. The measurement model — split contract from logic

### Where the function lives today (verified)

Today there is **no measurement abstraction**. The only relationship logic in the protocol is the
Delta Engine:

- `uvrn-core/src/core/engine.ts` → `runDeltaEngine(bundle, opts)` (exported)
- core math: `computeDelta(a, b) = |a − b| / ((a + b) / 2)` — **internal helper**, NOT exported from
  `@uvrn/core` (lives only inside `engine.ts`)
- a round loop compares source values, tracks the max delta in each round, and checks it against
  `bundle.thresholdPct`
- the result is a **two-value outcome**: `type Outcome = 'consensus' | 'indeterminate'` (a TypeScript
  **type alias**, not an enum)
- note: `DeltaReceipt` carries `deltaFinal`/`rounds`/`outcome`/`hash` — it has **no `vScore` field**

That is the entire relationship vocabulary in the live protocol. **Agree / Disagree / Conflict /
Potential do not exist anywhere.** Downstream packages compute *derived numbers* (agreement %,
V-Score, divergence) but none of them is a pluggable relationship type.

### The split (decided)

The build introduces a clean separation:

- **Contract (type) lives in `@uvrn/core`.**
  Define a `Measurement` **type only** — the shared shape describing what a measurement takes in
  (evidence / sources) and what it returns (a typed relationship result + a short, LLM-friendly
  explanation). This is **additive type surface**. It must **not** touch the live hash/verify path or
  alter the existing `Outcome` type alias. Core stays byte-for-byte compatible for existing receipts.

- **Logic lives in a new measurement layer, outside core.**
  Each measurement — **Agree, Disagree, Conflict, Potential** — is its own module implementing the
  contract, registered through a documented registry so a host can add/edit/swap measurements without
  redeploying or forking core.

```
sources  ─►  measurement modules (Agree | Disagree | Conflict | Potential | …)  ─►  master receipt
             ▲ implement the @uvrn/core Measurement contract                         ▲ records all
             │ pluggable registry — host supplies its own                            │ results + node status
```

**Why this shape:** it gives three things at once — one shared contract, a safe live core, and
measurements that are genuinely swappable. It also keeps protocol logic out of core, consistent with
the provider-agnostic rule.

### Measurement contract (shape, illustrative — final types in the build plan)

```
Measurement {
  type: string                 // 'agree' | 'disagree' | 'conflict' | 'potential' | <custom>
  evaluate(input): MeasurementResult
}

MeasurementResult {
  type: string                 // the measurement that produced this
  verdict: ...                 // typed relationship outcome
  confidence: number           // 0..1
  explanation: string          // short, factual, verbatim-ready (LLM-friendly)
  evidenceRefs: string[]       // which sources/specs drove the result
}
```

---

## 3. The master receipt — extend `@uvrn/core`

### Today: a linear chain

The receipt lineage is currently linear: **Delta → Drift → Agent → Canon**. Each stage wraps the
prior one. There is **no horizontal aggregation** — no single structure that holds *all* the
measurements run against a claim, and no receipt anywhere records **node/source health**. Health is
tracked loosely and transiently (`fetchedAt`, `durationMs`, an API `/health` route) but never
persisted onto a receipt.

### This build: a master receipt that extends core

Grow the master receipt **out of `@uvrn/core`'s existing receipt** (decided: extend core, not a new
package). It is a single structure that accumulates:

1. **Every source** that fed the claim.
2. **Every measurement result** that ran (agree/disagree/conflict/potential + any custom).
3. **Node status** for each participating node/source: **on / off / unavailable** — gaps are
   **recorded, not hidden.** If a node was off, the receipt says so.

**Hard constraint:** core is LIVE. The master receipt must be **additive only** — it must not change
the canonical hashing of existing receipts or break `verifyReceipt()`. New fields layer on top of the
existing verifiable payload; existing receipts remain valid and re-checkable. The master receipt
itself stays verifiable, including a faithful record of what was missing or down.

---

## 4. What the packages do today (capability inventory)

All 22 packages are **built/implemented in the repo** (real implementations, not stubs). Note: "LIVE"
in `CLAUDE.md` means *published to npm* — only 6 are live in that sense (`core`, `sdk`, `adapter`,
`mcp`, `api`, `cli`); the rest are pre-release or build targets. Framed by the **function/relationship**
each one provides:

| Package | What it provides (relationship / function lens) |
|---|---|
| `@uvrn/core` | The Delta Engine — the protocol's only current relationship logic (within-threshold → consensus/indeterminate). **Home of the new `Measurement` contract + master receipt.** |
| `@uvrn/sdk` | Programmatic access to the engine (CLI/HTTP/local modes), BundleBuilder, validators. |
| `@uvrn/adapter` | Wraps receipts in DRVC3 envelopes with EIP-191 signatures (issuer identity) — does not change deterministic hashes. |
| `@uvrn/mcp` | MCP **access layer** — exposes the protocol to AI agents (today: 3 core tools). |
| `@uvrn/api` | REST access (`/api/v1/delta/{run,validate,verify}`) + health. |
| `@uvrn/cli` | Command-line access (`uvrn run/validate/verify`). |
| `@uvrn/drift` | **Relationship over time** — temporal decay of confidence (linear/sigmoid/exponential) → status. |
| `@uvrn/agent` | Continuous monitoring loop; emits unsigned `AgentDriftReceipt`. |
| `@uvrn/canon` | Permanence — locks results into signed DRVC3 records (explicit canonization only). |
| `@uvrn/signal` | In-process event bus decoupling drift/canon/agent/watch. |
| `@uvrn/farm` | **Ingestion** — provider-agnostic connectors. NB: the `FarmConnector` interface + `ClaimRegistration` type are declared in `@uvrn/agent`; `fetch(claim: ClaimRegistration)` takes a structured claim object, not a bare string. |
| `@uvrn/normalize` | Standardizes raw sources into a stable shape via pluggable profiles. |
| `@uvrn/consensus` | **Agreement** scoring — ranks sources, computes agreement/coverage/recency, builds a bundle. |
| `@uvrn/score` | V-Score explainability (Completeness×0.35 + Parity×0.35 + Freshness×0.30). Re-exports core's canonical `VSCORE_WEIGHTS` as `WEIGHTS` and decomposes them. |
| `@uvrn/test` | Dev toolkit — mock receipts/connectors/stores/signers, fixtures (zero-external testing). |
| `@uvrn/compare` | **Divergence** — head-to-head and across-history claim comparison. |
| `@uvrn/identity` | Signer **reputation** from protocol facts; pluggable `IdentityStore` + `MockIdentityStore`. |
| `@uvrn/timeline` | Claim **history** reconstruction; pluggable `TimelineStore` + mock. |
| `@uvrn/watch` | **Change → alert**; pluggable `DeliveryTarget` (callback/webhook/Slack/Discord). |
| `@uvrn/embed` | Embeddable live-status badge (React or plain HTML). |
| `@uvrn/lattice` | Cross-domain **decomposition** of research questions into signal bundles. |
| `@uvrn/algox` | **Ranking/selection** of signal candidates (filter → score → select, diversity caps). |

---

## 5. What Shawn needs them to do (the gap)

Contrasting the inventory against the function-first model, three things are missing today:

1. **The modular `Measurement` abstraction.** Agree/Disagree/Conflict/Potential as swappable objects
   over a shared contract. *Today:* only `consensus | indeterminate`, hardcoded in the engine.
2. **The master receipt.** A single structure accumulating all measurements + sources for a claim.
   *Today:* a linear receipt chain with no horizontal aggregation.
3. **First-class node status.** "Node off / unavailable" as recorded, verifiable data on the receipt.
   *Today:* health is transient and never persisted to a receipt.

### Mapping existing packages → measurements

The measurement layer does not replace existing packages — it gives them a shared home and fills the
holes:

- **Agree** ← naturally backed by `@uvrn/consensus` agreement scoring + core's within-threshold result.
- **Disagree** ← naturally backed by `@uvrn/compare` divergence.
- **Conflict** ← **no current home.** New logic in the measurement layer (direct contradiction, not
  just numeric distance).
- **Potential** ← informed by `@uvrn/drift` (movement over time) + `@uvrn/algox` (emerging signal
  ranking), but **no current home** as a relationship type. New logic in the measurement layer.

**Gaps with no home:** Conflict and Potential as relationship types, the `Measurement` contract, the
master receipt, and node-status recording. These are exactly what this build adds.

---

## 6. How MCP fits (pointer, not focus)

MCP is an **access layer** onto the function above — one of several front doors (alongside SDK, API,
CLI, embed). It is not the architecture; it consumes it. Two rules apply specifically here:

1. **Every MCP tool's output contributes to the master receipt** (incl. node status), not a bare
   number. Receipts remain re-verifiable.
2. **Open, agnostic, agent-connectable by default** (see principle below). The MCP server advertises
   a discoverable capability contract any agent can self-configure against.

MCP expansion is specified in the side docs:
`BUILD-mcp-phase1-wire-in.md`, `BUILD-mcp-phase2-stateless-tools.md`, `DESIGN-mcp-config-model.md`,
`BUILD-mcp-phase3-canon.md`, `BUILD-mcp-phase4-live-scoring.md`, `BUILD-mcp-phase5-plugin-packaging.md`.

---

## 7. Cross-cutting principle — open, agnostic, agent-connectable by default (non-negotiable)

Everything in this build — **especially the MCP surface** — must be open and system-agnostic, ready
to connect to **any computer or agent system**, not just Claude/Cowork:

- **No system-specific default.** Nothing assumes Claude Desktop, a specific OS, a vendor, or a data
  provider. Any adopter can build in and customize — the default stays neutral and works anywhere.
- **Obvious connection points for local agents.** The protocol surfaces (especially MCP) advertise
  *how* and *what* to connect to — discoverable tools, I/O schemas, resources, prompts — as a
  documented contract any agent can read and self-configure against with no prior knowledge of the stack.
- **Standard, swappable transport.** stdio is the zero-config default; the design must not preclude
  other MCP-compatible transports/clients. Connecting a non-Claude agent requires no fork.
- **Pluggable everywhere.** Measurements, stores, signers, connectors register through documented
  interfaces; a host supplies its own without touching protocol logic.
- **Zero-external path always works.** Mocks / in-memory / in-process defaults give a fully functional
  system with no signup, on any machine.
- **Document "you connect here."** Every README and this architecture make connection points explicit:
  here is the contract, here is how your agent plugs in, here is what's swappable.

This hardens the existing provider-agnostic rules in `CLAUDE.md`. It governs all build plans.

---

## 8. Invariants this build must not violate

- V-Score formula/weights live **only** in `@uvrn/core` (`VSCORE_WEIGHTS`). `@uvrn/score` re-exports them as `WEIGHTS` and decomposes — never a second definition.
- **No auto-canonization.** `canonize()` is always explicit.
- No storage in core/drift/agent. Stores are pluggable and host-owned.
- Peer deps for all `@uvrn/*` links. No circular deps.
- `dist/` is never committed.
- Core changes are **additive only** — existing receipt hashing and `verifyReceipt()` unchanged.
- **Self-documenting code (required).** Every module, exported type, and object carries a short
  doc comment (JSDoc/TSDoc) saying — in plain language — **what it is** and **what it does**, so any
  dev or agent reading the code (or its generated `.d.ts`) understands the module without external
  docs. Public functions document params, return, and a one-line purpose. Each measurement module
  states its rule (e.g. "Conflict: fires when two sources assert mutually exclusive values"). This is
  the LLM-friendly-explanation rule applied at the code level — connection points and module intent
  must be readable straight from the source.

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
*Claude Cowork — research and planning. Implementation owned by Cursor/Codex per AGENTS.md.*
