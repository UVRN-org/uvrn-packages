# Build Plan — `@uvrn/core` Master Receipt (additive extension)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/core` (LIVE — additive changes only)
**Depends on**: `BUILD-core-measurement-contract.md` (uses `MeasurementResult`, `NodeStatus`)
**Relates to**: `BUILD-measurement-layer.md` (produces the `MeasurementResult[]` the receipt collects)
**Protocol**: Bloom v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Source**: `.admin/executive/ARCHITECTURE-uvrn-master.md` §3

---

## Plan

Add a **master receipt** that extends `@uvrn/core`'s existing receipt to accumulate, in one structure:
every source, every measurement result, and **node status (on / off / unavailable)**. Gaps are
recorded, not hidden.

**Critical constraint:** core is LIVE. This is **additive only**. The canonical hashing of the
existing `DeltaReceipt` and the behavior of `verifyReceipt()` **must not change**. Existing receipts
stay byte-for-byte valid. The master receipt is a *superset wrapper/extension*, not a redefinition.

## Build

1. Add `uvrn-core/src/types/master-receipt.ts`:
   ```ts
   import type { DeltaReceipt } from './...';        // existing
   import type { MeasurementResult, NodeStatus } from './measurement';

   export interface NodeStatusRecord {
     id: string;                 // source/node id
     status: NodeStatus;         // 'on' | 'off' | 'unavailable'
     detail?: string;            // optional reason (e.g. 'timeout', 'auth failed')
     observedAt?: string;        // ISO timestamp
   }

   export interface MasterReceipt {
     envelopeVersion: number;            // hashed-shape version (starts at 1); bump if the recipe changes
     claim: string;
     base: DeltaReceipt;                 // the existing, unchanged, independently-verifiable receipt
     measurements: MeasurementResult[];  // all measurements run for this claim
     nodes: NodeStatusRecord[];          // full node roster incl. off/unavailable
     ts: string;
     // additive hash over the master envelope ONLY — does not replace base.hash
     masterHash: string;
   }
   ```
2. Add a pure builder `uvrn-core/src/core/master-receipt.ts`:
   ```ts
   export function buildMasterReceipt(args: {
     base: DeltaReceipt;
     measurements: MeasurementResult[];
     nodes: NodeStatusRecord[];
     claim?: string;
     timestamp?: string;
   }): MasterReceipt;

   export function verifyMasterReceipt(mr: MasterReceipt): {
     verified: boolean;
     baseVerified: boolean;       // delegates to existing verifyReceipt(base)
     masterHashOk: boolean;
     error?: string;
   };
   ```
   - `masterHash` — **exact recipe (decision-complete, do not vary):**
     ```ts
     masterHash = sha256(canonicalJson({
       envelopeVersion: 1,        // bump only when the hashed shape changes
       claim,
       baseHash: base.hash,       // base participates ONLY via its hash, not the full base payload
       measurements,              // MeasurementResult[] in input order
       nodes,                     // NodeStatusRecord[] in roster order
       ts,
     }));
     ```
     - Reuse core's existing `canonicalJson` + `sha256` helpers — **do not invent a second scheme**.
     - **Fixed key order exactly as listed above.**
     - **Forward-compat rule:** any future optional field is **excluded** from the hash unless it is
       added here under an `envelopeVersion` bump. Additive fields **never silently change** `masterHash`.
   - `verifyMasterReceipt` calls the existing `verifyReceipt(base)` for `baseVerified`, then recomputes
     `masterHash`. The base receipt remains independently verifiable on its own.
3. Re-export the types + builder from `uvrn-core/src/index.ts`.
4. **No auto-population from any provider.** The caller supplies `nodes` and `measurements`. Core does
   not fetch, does not decide node health, does not run measurements — it records what it is given.

## Check

- `pnpm --filter @uvrn/core run build` + `run test` green; **existing tests unchanged**.
- Regression: hash of a fixture `DeltaReceipt` is identical pre/post change; `verifyReceipt()` output
  unchanged (proves additive-only).
- New tests: `buildMasterReceipt` round-trips through `verifyMasterReceipt` (verified=true); tampering
  with any measurement or node record flips `masterHashOk` to false; an `off`/`unavailable` node is
  preserved verbatim in `nodes`.
- Verify a `MasterReceipt` whose `base` is also independently verifiable via the untouched `verifyReceipt`.
- **Tarball gate:** `pnpm pack` (or `npm pack`) `@uvrn/core`, install the tarball in a clean dir, and
  confirm `buildMasterReceipt` / `verifyMasterReceipt` import and run from the published surface —
  since this changes a LIVE package's shipped API.

## Update

- `uvrn-core/CHANGELOG.md`: minor bump — "Added master receipt (additive); existing receipt hashing unchanged."
- `uvrn-core/README.md`: "Master receipt" subsection — what it aggregates, the node-status semantics
  ("node off is recorded, never hidden"), and the explicit additive/no-hash-change guarantee.

## Reflect

- Record in `.admin/findings/` any tension between the master envelope hash and downstream signing
  (`@uvrn/adapter`) so the audit can confirm signatures still target the unchanged base receipt.

## Continue

- Master receipt becomes the output shape MCP tools and the measurement layer feed into. Proceed to
  MCP side docs (`BUILD-mcp-phase*`).

---

## MUST NOT include

- ❌ Any change to existing `DeltaReceipt` hashing, `runDeltaEngine`, or `verifyReceipt`.
- ❌ A second/competing hash scheme — reuse core's canonical hashing helper.
- ❌ Auto-fetching node health or auto-running measurements inside core (caller supplies them).
- ❌ Auto-canonization or storage — core stores nothing.
- ❌ Any provider/vendor-specific node or source field.
