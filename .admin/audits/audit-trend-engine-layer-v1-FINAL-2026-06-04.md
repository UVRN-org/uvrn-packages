# Audit — trend-engine-layer-v1 Planning Docs (Final)

VERDICT: GO-WITH-FIXES

This planning set is materially improved from the prior audit. The previously reported API-binding errors are now corrected in the architecture and build-plan docs. The remaining issues are not outright signature mismatches; they are residual specification gaps that still leave an implementer making protocol decisions in a few critical areas, most notably `@uvrn/measure` semantics, `RuntimeConfig` injection wiring, and the exact master-receipt hash payload.

## Section 1 — Prior-Fix Confirmation Table

| Requested fix | Status | Doc proof | Repo proof |
|---|---|---|---|
| `Outcome` described as a type alias, not an enum | CONFIRMED | `.admin/executive/ARCHITECTURE-uvrn-master.md:58-59`; `.admin/build-plans/BUILD-core-measurement-contract.md:21-26` | `uvrn-core/src/types/index.ts:37` defines `export type Outcome = 'consensus' | 'indeterminate';` |
| `computeDelta` described as internal-only, not exported from `@uvrn/core` | CONFIRMED | `.admin/executive/ARCHITECTURE-uvrn-master.md:53-55`; `.admin/build-plans/BUILD-core-measurement-contract.md:22-26` | `uvrn-core/src/core/engine.ts:26-35` defines `function computeDelta(...)` with no export |
| `DeltaReceipt` described as having no `vScore` / `v_score` | CONFIRMED | `.admin/executive/ARCHITECTURE-uvrn-master.md:60`; `.admin/build-plans/BUILD-core-measurement-contract.md:25-27` | `uvrn-core/src/types/index.ts:39-48` shows `DeltaReceipt` fields and no `vScore` |
| Phase 2 drift tool takes `DriftInputReceipt`, not raw `DeltaReceipt`, and states scoring enrichment is caller-supplied | CONFIRMED | `.admin/build-plans/BUILD-mcp-phase2-stateless-tools.md:26-40` | `uvrn-drift/src/index.ts:33-37` defines `computeDrift(receipt: DriftInputReceipt, profile, asOf)` |
| Phase 2 compare tool requires claim/V-Score-bearing receipts and rejects raw `DeltaReceipt` | CONFIRMED | `.admin/build-plans/BUILD-mcp-phase2-stateless-tools.md:41-46` | `uvrn-compare/src/engine/analysis.ts:60-85` throws if `claimId` or `vScore` cannot be derived |
| Config model uses `canonStores: CanonStore[]` plus `CanonSigner`, aligned to real canon config | CONFIRMED | `.admin/build-plans/DESIGN-mcp-config-model.md:23-36` | `uvrn-canon/src/types/index.ts:93-120` defines `CanonConfig { stores: CanonStore[]; signer: CanonSigner; ... }` |
| Phase 3 canon uses `qualify(claimId, snapshot)` and `read(canonId)`, with no write path | CONFIRMED | `.admin/build-plans/BUILD-mcp-phase3-canon.md:13-29` | `uvrn-canon/src/index.ts:39-66` defines `qualify(claimId, snapshot)`; `uvrn-canon/src/types/index.ts:85-89` defines `read(canonId)` |
| Phase 4 states `FarmConnector.fetch(claim: ClaimRegistration)` comes from `@uvrn/agent`, adds a string→`ClaimRegistration` adapter, and adds `@uvrn/agent` as a dependency source | CONFIRMED | `.admin/build-plans/BUILD-mcp-phase4-live-scoring.md:28-40`; `.admin/executive/ARCHITECTURE-uvrn-master.md:156` | `uvrn-agent/src/types/index.ts:8-16` defines `ClaimRegistration`; `uvrn-agent/src/types/index.ts:65-67` defines `FarmConnector.fetch(claim: ClaimRegistration)` |
| Architecture inventory no longer claims “all 22 LIVE” in the npm-published sense | CONFIRMED | `.admin/executive/ARCHITECTURE-uvrn-master.md:139-141` | `CLAUDE.md` distinguishes npm-live packages from pre-release/build-target packages |
| Measurement-layer doc treats sibling reuse as adapter-driven optional integration, with first-party internal logic as the default path | CONFIRMED | `.admin/build-plans/BUILD-measurement-layer.md:29-38` | `uvrn-compare/src/engine/analysis.ts:60-85` and `uvrn-drift/src/index.ts:33-37` confirm these siblings need enriched adapter input rather than `MeasurementInput` directly |

## Section 2 — Findings

### Major

1. **`@uvrn/measure` still leaves `conflict` semantics under-specified.**
   - Doc: `.admin/build-plans/BUILD-measurement-layer.md` §Build, `conflict.ts` (`:47-49`)
   - Issue: The plan now correctly identifies `conflict` as new first-party logic, but it still leaves the actual contradiction rule open-ended: “e.g. opposite boolean/categorical verdicts, or non-overlapping ranges.” That is not decision-complete. An implementer still has to choose the protocol rule.
   - Repo truth: No existing `Measurement` or `conflict` abstraction exists anywhere in the repo to inherit from.
   - Recommended fix: Lock one rule set in the plan. Example: “`conflict` fires when at least two sources for the same claim yield mutually exclusive categorical/boolean outcomes or disjoint asserted ranges over the same field; numeric spread alone is `disagree`, not `conflict`.”

2. **`@uvrn/measure` still leaves `potential` semantics under-specified.**
   - Doc: `.admin/build-plans/BUILD-measurement-layer.md` §Build, `potential.ts` (`:50-52`)
   - Issue: “movement-over-time” plus “low-but-rising agreement” is directionally clear but still leaves thresholds, lookback windows, and required evidence shape undefined.
   - Repo truth: No existing `potential` relationship type exists in the repo to supply these rules.
   - Recommended fix: Specify the minimum rule set: required number of observations, how “rising” is computed, what agreement threshold ceiling qualifies as still unresolved, and what verdict to emit on insufficient history.

3. **`MeasurementInput` / `MeasurementResult` may be too thin for the four measurements as planned, especially `conflict`.**
   - Doc: `.admin/build-plans/BUILD-core-measurement-contract.md` §Build (`:37-65`)
   - Issue: `MeasurementSource` currently exposes only `id`, `value?`, `label?`, `ts?`, `status?`. That shape is adequate for numeric convergence, but weak for categorical contradiction, asserted ranges, or provenance-rich evidence references.
   - Repo truth: The current live packages do not provide a shared measurement abstraction; this new type surface must be sufficient on its own.
   - Recommended fix: Either extend `MeasurementSource` with a typed evidence payload such as `kind`, `assertion`, `range`, or `attributes`, or explicitly constrain v1 measurements to numeric-only evidence and defer categorical conflict to a later revision.

4. **`RuntimeConfig` is defined conceptually but not wired into `@uvrn/mcp` construction in an implementation-complete way.**
   - Doc: `.admin/build-plans/DESIGN-mcp-config-model.md` §The model (`:20-50`)
   - Issue: The doc now names the right config fields, but it still does not specify how `RuntimeConfig` enters `createServer()`, how handlers access it, whether it is a singleton module, constructor arg, or closure-bound dependency, or how test injection works.
   - Repo truth: The live MCP server currently has `createServer(): Server` with handlers importing from static modules, and config loading is env-driven in `uvrn-mcp/src/config.ts`.
   - Proof: `uvrn-mcp/src/server.ts` constructs the server with no runtime arg; `uvrn-mcp/src/config.ts` exports `config = loadConfig()`.
   - Recommended fix: Amend the design doc with one explicit integration pattern, e.g. `createServer(runtimeConfig?: RuntimeConfig)` plus a `buildHandlers(runtimeConfig)` factory, and require all Phase 3+ tools to consume injected dependencies through that path.

5. **Master-receipt hashing is improved but still not precise enough for implementation without further choice.**
   - Doc: `.admin/build-plans/BUILD-core-master-receipt.md` §Build (`:63-67`)
   - Issue: The plan says `masterHash` covers “measurements + nodes + base.hash + claim + ts” using existing canonical JSON hashing, but it does not lock the exact serialized object shape, key order contract, or forward-compatibility rule for future additive fields.
   - Repo truth: Existing base receipt hashing is exact and deterministic in core; additive guarantees depend on the master envelope being equally exact.
   - Recommended fix: Define the precise hashed payload, e.g. `hashReceipt({ claim, baseHash: base.hash, measurements, nodes, ts })`, and state whether future optional fields are excluded unless versioned into the envelope.

### Minor

1. **Phase 4 dependency header is slightly incomplete relative to its own build steps.**
   - Doc: `.admin/build-plans/BUILD-mcp-phase4-live-scoring.md:5`
   - Issue: The header `Depends on` line lists `@uvrn/farm`, `@uvrn/normalize`, `@uvrn/consensus`, `@uvrn/core`, but the body correctly states `@uvrn/agent` is also required because `FarmConnector` and `ClaimRegistration` live there (`:28-40`).
   - Repo truth: `uvrn-agent/src/types/index.ts:8-16,65-67`
   - Recommended fix: Add `@uvrn/agent` to the header dependency line for consistency.

2. **The dated MCP report still contains stale historical wording, but the corrected build plans supersede it.**
   - Doc: `.admin/reports/report-mcp-integration-plan-2026-06-04.md`
   - Issue: The report remains older framing and should be treated as historical context only.
   - Recommended fix: None required for build gating. Optionally add a note at the top that later build plans supersede it where they disagree.

## Section 3 — Build-Readiness Checklist

| Area | Status | Notes |
|---|---|---|
| `@uvrn/core` measurement contract | ready | Prior API-surface corrections are in place; additive-only guardrails are explicit. |
| `@uvrn/measure` | blocked | `conflict` and `potential` semantics are not decision-complete; `MeasurementInput` may be insufficient for non-numeric conflict handling. |
| `@uvrn/core` master receipt | blocked | Additive-only intent is correct, but the exact `masterHash` payload contract is still underspecified. |
| MCP Phase 1 | ready | Accurate to current `@uvrn/mcp` surface: 3 tools, 4 resources, 3 prompts, stdio transport, agnostic connection framing. |
| MCP Phase 2 | ready | The earlier raw-`DeltaReceipt` mistake is corrected; enriched/scored input prerequisites are now accurately documented. |
| MCP config model | blocked | Correct field names and canon alignment are present, but runtime injection into `createServer()` / handlers is not yet implementation-complete. |
| MCP Phase 3 | ready | Read-only canon surface is accurately specified; no `delta_canonize` path is exposed. |
| MCP Phase 4 | blocked | Connector API source and adapter requirement are now correct, but it depends on unresolved master-receipt and config-injection details. |
| MCP Phase 5 | ready | Packaging guidance is agent-agnostic and consistent with current MCP structure, assuming earlier phases are stabilized. |

## Constraint Sweep Notes

- **No auto-canonization:** honored. Phase 3 is read-only and explicitly excludes `delta_canonize`.
- **Provider-agnostic defaults:** honored. No default `CoinGeckoFarm`; config docs and Phase 4 both treat named providers as examples only.
- **Core changes additive only:** honored in intent, but master-receipt hash payload needs one more level of exactness before implementation.
- **Peer deps / no cycles:** honored in the docs reviewed. `@uvrn/measure` is described as optional-peer-only for sibling reuse, and no reverse dependency is introduced.
- **V-Score weights only in `@uvrn/score`:** honored.
- **`dist/` / `.claude/` gitignored:** confirmed by worktree `.gitignore` (`.gitignore:1-16`); no staged build artifacts observed in `git status --short`.
- **Open / agnostic / agent-connectable MCP framing:** honored across Phase 1 and Phase 5, with Claude kept as an example rather than the default assumption.

## Final Assessment

This is now a materially safer planning set than the prior version. The docs no longer invent or misstate the key live APIs they depend on. The remaining work is to tighten specification completeness, not to repair broken repo bindings. That keeps the verdict at **GO-WITH-FIXES** rather than **NO-GO**.
