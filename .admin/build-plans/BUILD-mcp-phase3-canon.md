# Build Plan — MCP Phase 3: Canon Read Tools (side doc)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/mcp` (LIVE)
**Depends on**: `DESIGN-mcp-config-model.md` (RuntimeConfig must exist); `@uvrn/canon`
**Protocol**: Bloom v1.7
**Source**: report §4; architecture §6, §8

---

## Plan

Add **read-only** canon tools that respect the protocol rule **no auto-canonization**:
`delta_canon_qualify` (suggest-only candidacy assessment) and `delta_canon_get` (retrieve by ID via a
configured `CanonStore`). The write path (`delta_canonize`) is **out of scope** until a confirmation
model is specified.

## Build

1. Construct a `Canon` from `RuntimeConfig` (`canonStores: CanonStore[]` default `[new MockStore()]`,
   `canonSigner` default `MockSigner`) — zero-external path. `import { Canon, MockStore, MockSigner } from '@uvrn/canon'`.
2. Tools (same 4-place pattern: handlers.ts, schemas.ts, types.ts, both registrations in server.ts):
   - **`delta_canon_qualify`** → `canon.qualify(claimId, snapshot)`. **Verified signature:** positional
     `qualify(claimId: string, snapshot: DriftSnapshot): QualificationResult` — NOT an object arg, and
     it takes a **`DriftSnapshot`**, not a `DeltaReceipt`/`driftReceipt`.
     Input: `{ claimId: string, snapshot: DriftSnapshot }`; Output: `QualificationResult`.
     **Assessment only — performs no write.**
   - **`delta_canon_get`** → `store.read(canonId)`. **Verified:** `CanonStore` exposes `read(canonId)`,
     not `get()`. Input: `{ canonId: string }`; Output: `CanonReceipt | null`.
3. Peer dep: add `@uvrn/canon` (`>=1.0.0`); devDep `workspace:*`. No circular deps. (`DriftSnapshot`
   originates in `@uvrn/drift` — re-exported through canon's types; confirm the import path at build.)

## Check

- `pnpm --filter @uvrn/mcp run build` + `run test` green.
- Tests: `qualify` returns a `QualificationResult` and **never writes** (assert store unchanged);
  `read` returns a known record and `null` for a missing `canonId`; default `[MockStore]` + `MockSigner`
  path works with no external service.

## Update

- `uvrn-mcp/README.md`: document both tools, the explicit "qualify ≠ canonize" distinction, and the
  configurable store.
- `uvrn-mcp/CHANGELOG.md`: minor bump.

## Reflect

- If a confirmation model for `delta_canonize` becomes worth specifying, log it in `.admin/findings/`
  — do not implement it here.

## Continue

- Proceed to `BUILD-mcp-phase4-live-scoring.md`.

---

## MUST NOT include

- ❌ `delta_canonize` or any write/canonization path — **no auto-canonize, ever**.
- ❌ A hardcoded store — use the configured `CanonStore` (default `MockStore`).
- ❌ Storage logic inside the MCP layer (delegate to the store interface).
