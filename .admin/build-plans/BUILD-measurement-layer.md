# Build Plan — `@uvrn/measure` Measurement Layer (new package)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/measure` (NEW)
**Depends on**: `BUILD-core-measurement-contract.md` (the `Measurement` contract must exist first)
**Blocks**: `BUILD-core-master-receipt.md` consumers, MCP Phase 2+ (measurement-backed tools)
**Protocol**: Bloom v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Source**: `.admin/executive/ARCHITECTURE-uvrn-master.md` §2, §5

---

## Plan

Create a new package `@uvrn/measure` that holds the **measurement logic** as swappable modules
implementing the `@uvrn/core` `Measurement` contract: **Agree, Disagree, Conflict, Potential** — plus
a **registry** so a host can add/edit/swap measurements without forking core.

This is the headline functional addition. Core stays type-only; all relationship computation lives here.

**Package name decision:** `@uvrn/measure` (neutral, function-named). Not "trend" — trend use cases
are README examples only, never package logic.

## Build

1. **Scaffold** `uvrn-measure/` matching the house package layout (`src/`, `package.json`, `tsconfig`,
   `README.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore` with `dist/`). Confirm `dist/` is ignored.
   - `package.json` **must** include `files: ["dist", "README.md", "LICENSE"]`, `publishConfig:
     { "access": "public" }`, and a `LICENSE` file present in the package.
   - Published deps (`peerDependencies`) use **semver** ranges only. `workspace:*` is allowed in
     `devDependencies` only (it does not ship; pnpm rewrites it on publish). Publish via `pnpm`.
2. **Peer deps** in `uvrn-measure/package.json`:
   - `@uvrn/core` (peer, `>=1.0.0`) — for the `Measurement` contract types.
   - **Optional reuse of sibling packages** — `@uvrn/consensus` (informs **Agree**),
     `@uvrn/compare` (informs **Disagree**), `@uvrn/drift` (informs **Potential**).
   - ⚠️ **Reuse is not free (verified).** These siblings do **not** accept `MeasurementInput` directly:
     `@uvrn/compare` requires `claimId` + `vScore`; `@uvrn/drift.computeDrift` requires a
     `DriftInputReceipt` (`receipt_id`, `v_score`, `components`). Bridging to them needs an explicit
     **adapter** plus the same scoring enrichment as MCP Phase 2. Therefore:
   - **Default path = first-party internal measurement logic** over `MeasurementInput` (no sibling
     required). Treat sibling integration as **optional, later** work behind a documented adapter.
   - Mark the three above `optional: true` in `peerDependenciesMeta` so `@uvrn/measure` stays
     installable standalone; the internal logic is the primary path, not a fallback.
   - devDeps: `@uvrn/core` `workspace:*`, `@uvrn/test` `workspace:*`, plus the standard tooling.
   - **No circular deps**: `@uvrn/measure` may depend on consensus/compare/drift; none of those may
     depend back on `@uvrn/measure`. Verify before merge.
3. **Modules** — one file per measurement under `uvrn-measure/src/measurements/`, each exporting a
   `Measurement` implementation:
   - `agree.ts` — converge within tolerance. Reuse `@uvrn/consensus` agreement scoring when present;
     else compute an internal agreement ratio. `verdict: 'agree' | 'no-agreement'`.
   - `disagree.ts` — material divergence in direction/value. Reuse `@uvrn/compare` divergence when present.
   - `conflict.ts` — **new logic, DECISION-COMPLETE RULE (do not leave open):**
     `conflict` fires when, for the same claim/field, **at least two sources assert mutually
     exclusive values**:
       (a) two **boolean or categorical** assertions that differ (e.g. `rain=true` vs `rain=false`;
           `category='A'` vs `category='B'`), **or**
       (b) two **asserted ranges that are disjoint** (no overlap) over the same field.
     Pure numeric spread is **`disagree`, never `conflict`**. A source carrying only a numeric `value`
     (no categorical/boolean/range assertion) **cannot** trigger `conflict` in v1.
     `verdict: 'conflict' | 'none'`. `explanation` must name the two contradicting sources + values.
   - `potential.ts` — **new logic, DECISION-COMPLETE RULE:**
     `potential` fires when a claim is **not yet Agree** but is **trending toward agreement**:
       (a) requires a **minimum of N observations over time** (default `N = 3`, configurable),
       (b) **"rising"** = the agreement score across the last `K` observations (default `K = 3`) is
           monotonically non-decreasing with a net positive change,
       (c) current agreement is still **below the Agree threshold** (unsettled),
       (d) if fewer than `N` observations exist, emit `verdict: 'none'` with a `confidence` that
           reflects insufficient history — **never** emit `'potential'` on thin history.
     `verdict: 'potential' | 'none'`. Movement-over-time may use `@uvrn/drift` when present (optional).
   - Every result sets `confidence` (0..1), a short factual `explanation`, and `evidenceRefs`.
4. **Registry** `uvrn-measure/src/registry.ts`:
   ```ts
   export class MeasurementRegistry {
     register(m: Measurement): void;      // add or replace by m.type
     unregister(type: MeasurementType): void;
     get(type: MeasurementType): Measurement | undefined;
     list(): Measurement[];
     runAll(input: MeasurementInput): MeasurementResult[];   // every registered measurement
   }
   export function defaultRegistry(): MeasurementRegistry;   // pre-loaded with the 4 starters
   ```
   The registry is the documented connection point: a host calls `register()` with its own module.
5. **Root export** `uvrn-measure/src/index.ts`: the four measurements, `MeasurementRegistry`,
   `defaultRegistry`, and a re-export of the core `Measurement`/`MeasurementResult` types for convenience.
6. **Code documentation (required).** Each measurement module opens with a doc comment stating, in plain
   language, **what it is, what it does, and its exact rule** (e.g. the conflict/potential rules above).
   The registry and every exported type/method carry TSDoc. A dev or agent must understand each
   module from the source/`.d.ts` alone — no external doc needed. (Per architecture invariant §8.)

## Check

- `pnpm --filter @uvrn/measure run build` and `... run test` green.
- Unit tests (vitest/jest per repo convention) per measurement: a clear positive case, a clear
  negative case, and a degraded-input case (missing values). For `conflict` and `potential`, test the
  defined rule precisely.
- Registry tests: register/replace/unregister, `runAll` returns one result per registered measurement.
- Standalone-install test: build with the optional peers **absent** — fallback paths must work
  (zero-external path). Smoke install from tarball in a clean dir.
- No-circular-dep check: `@uvrn/consensus`/`@uvrn/compare`/`@uvrn/drift` do not import `@uvrn/measure`.

## Update

- `uvrn-measure/README.md`: minimal install, the four measurements, **how to add a custom measurement**
  (implement `Measurement`, `registry.register(...)`), and the interface-vs-example distinction.
- `uvrn-measure/CHANGELOG.md`: v1.0.0 entry.
- Add `@uvrn/measure` to `pnpm-workspace.yaml` if not auto-included.
- Root `README.md` / package index: list the new package.

## Reflect

- Record in `.admin/findings/` any case where the `conflict`/`potential` rules felt under-specified —
  these are new semantics with no prior art in the protocol.

## Continue

- Hand to `BUILD-core-master-receipt.md` (the master receipt aggregates `MeasurementResult[]`).

---

## MUST NOT include

- ❌ Redefining the `Measurement` contract — import it from `@uvrn/core`.
- ❌ Redefining V-Score weights — those live only in `@uvrn/core` (`VSCORE_WEIGHTS`; `@uvrn/score` re-exports them as `WEIGHTS`).
- ❌ Hard (non-peer) dependencies on consensus/compare/drift, or any circular dependency.
- ❌ Any storage, signer, network call, or provider/vendor-specific code.
- ❌ A non-functional standalone path — it must work with the optional peers absent.
- ❌ "Trend" / market / prediction logic in package code (README example mention only).
