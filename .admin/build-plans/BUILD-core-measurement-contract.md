# Build Plan — `@uvrn/core` Measurement Contract (additive type only)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/core` (LIVE — additive changes only)
**Depends on**: nothing (foundational)
**Blocks**: `BUILD-measurement-layer.md`, `BUILD-core-master-receipt.md`
**Protocol**: Bloom v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Source**: `.admin/executive/ARCHITECTURE-uvrn-master.md` §2

---

## Plan

Add the **`Measurement` contract as a type-only surface** to `@uvrn/core`. This is the shared shape
every measurement module (Agree/Disagree/Conflict/Potential and custom) implements. No measurement
*logic* lands here — only types.

**Why core:** the contract is protocol-level and must be importable by the measurement layer and by
any host that writes its own measurement. Types are additive and safe.

**Non-negotiable:** must not touch the live hash/verify path, the `Outcome` **type alias**
(`type Outcome = 'consensus' | 'indeterminate'`), `runDeltaEngine`, the internal `computeDelta` helper,
`validateBundle`, or `verifyReceipt`. Existing receipts stay byte-for-byte valid.

> **API note (verified against source):** `Outcome` is a type alias, not an enum. `computeDelta` is an
> **internal** helper in `engine.ts` — not exported from `@uvrn/core`. `DeltaReceipt` has **no `vScore`**
> field. The exported core surface this plan relies on: `runDeltaEngine`, `validateBundle`, `verifyReceipt`.

## Build

1. Add `uvrn-core/src/types/measurement.ts` exporting (final names at implementer's discretion, but
   honor this shape):
   ```ts
   export type MeasurementType = 'agree' | 'disagree' | 'conflict' | 'potential' | (string & {});
   // open union: custom measurement types are allowed (string & {} preserves autocomplete)

   export interface MeasurementInput {
     claim: string;
     sources: ReadonlyArray<MeasurementSource>;
     // optional context (thresholds, profile name) — measurement-defined, never provider-specific
     context?: Record<string, unknown>;
   }

   // Sources carry typed evidence so non-numeric measurements (conflict on categories/booleans)
   // work in v1 — not just numeric convergence. (Decision: extend the shape, do NOT defer conflict.)
   export interface MeasurementSource {
     id: string;
     kind?: 'numeric' | 'categorical' | 'boolean' | 'range';  // what `assertion`/`value`/`range` mean
     value?: number;          // numeric evidence (kind 'numeric')
     assertion?: string;      // categorical/boolean assertion (e.g. 'rain', 'true', 'category:A')
     range?: { min: number; max: number };  // asserted range (kind 'range')
     attributes?: Record<string, unknown>;  // provenance / extra evidence fields
     label?: string;
     ts?: string;             // ISO timestamp
     status?: NodeStatus;     // see master-receipt plan; optional here
   }

   export type NodeStatus = 'on' | 'off' | 'unavailable';

   export interface MeasurementResult {
     type: MeasurementType;
     verdict: string;         // typed relationship outcome, measurement-defined
     confidence: number;      // 0..1
     explanation: string;     // short, factual, verbatim-ready (LLM-friendly)
     evidenceRefs: string[];  // MeasurementSource ids that drove the result
   }

   export interface Measurement {
     readonly type: MeasurementType;
     evaluate(input: MeasurementInput): MeasurementResult;
   }
   ```
2. Re-export from `uvrn-core/src/types/index.ts` and the package root `uvrn-core/src/index.ts` so
   `import { Measurement, MeasurementResult } from '@uvrn/core'` works.
3. **No runtime code.** No registry, no implementations, no engine changes.

## Check

- `pnpm --filter @uvrn/core run build` — clean.
- `pnpm --filter @uvrn/core run test` — existing tests unchanged and green (proves no behavior drift).
- Add 1 type-level test (or `tsd`-style assertion if present) confirming the exports are importable.
- Confirm `verifyReceipt()` output on a fixture receipt is identical to pre-change (hash unchanged).
- **Tarball gate:** `pnpm pack` (or `npm pack`) `@uvrn/core`, install the resulting tarball in a clean
  dir, and confirm the new `Measurement` types import from the published surface — since this changes a
  LIVE package's shipped types.

## Update

- `uvrn-core/CHANGELOG.md`: minor bump — "Added `Measurement` contract types (additive, no behavior change)."
- `uvrn-core/README.md`: short "Measurement contract" subsection — interface vs. implementation note;
  state that logic lives in the measurement layer, not core.

## Reflect

- Note in `.admin/findings/` if the open-union `MeasurementType` causes any downstream typing friction.

## Continue

- Hand to `BUILD-measurement-layer.md` (implements this contract) and `BUILD-core-master-receipt.md`
  (consumes `MeasurementResult` + `NodeStatus`).

---

## MUST NOT include

- ❌ Any measurement *logic* (agree/disagree/conflict/potential computation).
- ❌ Changes to `Outcome`, `runDeltaEngine`, `computeDelta`, hashing, or `verifyReceipt`.
- ❌ A registry or runtime exports (those live in the measurement layer).
- ❌ Any provider-, vendor-, or service-specific field in the contract.
- ❌ Storage, signers, or network calls.
