# Build Plan — MCP Phase 2: Stateless Tools (side doc)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/mcp` (LIVE)
**Depends on**: Phase 1; `@uvrn/drift`, `@uvrn/compare`, optional `@uvrn/identity`
**Protocol**: Bloom v1.7
**Source**: report §2; architecture §6

---

## Plan

Add **stateless** tools only — no stores, signers, providers, or long-lived state:
`delta_score_drift` (drift), `delta_compare` (compare), and optional `delta_verify_identity`
(identity, in-memory mock only). Each follows the existing handler pattern.

## Build

For **each** new tool, edit the same four places the current tools use:
- `uvrn-mcp/src/tools/handlers.ts` — add `async handle<Tool>(input): Promise<...>`.
- `uvrn-mcp/src/tools/schemas.ts` — add the JSON input schema.
- `uvrn-mcp/src/types.ts` — add `…Input` / `…Output` types.
- `uvrn-mcp/src/server.ts` — add to **both** the `ListToolsRequestSchema` static list (`server.ts:52-80`)
  **and** the `CallToolRequestSchema` dispatch `switch` (`server.ts:83-160`).

> **Critical input-shape note (verified against source).** A plain `@uvrn/core` `DeltaReceipt`
> **cannot** drive drift or compare directly — it has no `vScore`/`v_score`, no `components`, and no
> `claimId`. These tools must take the **enriched / scored** shapes below, not a raw `DeltaReceipt`.
> If the only thing a caller has is a `DeltaReceipt`, scoring it (via `@uvrn/score` →
> `vScore` + components) is a **prerequisite step the caller supplies** — the MCP tool does not invent
> those fields.

Tools:
1. **`delta_score_drift`** → `import { computeDrift, profileFor } from '@uvrn/drift'`.
   - Input: `{ receipt: DriftInputReceipt, asOf?: string, profile?: string }`, where
     `DriftInputReceipt = { receipt_id, issuer, timestamp, v_score, components, claim_id?, tags? }`
     (drift's own type — re-export it in the tool schema; do **not** accept a bare `DeltaReceipt`).
   - Resolve profile via `profileFor(profile)` — **profile is an explicit input with a documented
     default**, never hardcoded to one domain.
   - Output: the `DriftReceipt` (decayed score + status + curve/profile).
2. **`delta_compare`** → `import { CompareEngine } from '@uvrn/compare'`.
   - Input: `{ receipts: ScoredReceipt[], options?: { normalize?: boolean } }`, exactly 2 unique
     claims. Each receipt must carry `claimId` (or `claim_id`) **and** `vScore` (or `v_score`) —
     `CompareEngine.parseReceipt` throws without them. A `DriftReceipt` or a scored envelope satisfies
     this; a raw `DeltaReceipt` does not.
   - Output: `CompareResult` (winner/loser/delta/divergenceAt/summary).
3. **`delta_verify_identity`** (optional) → `import { IdentityRegistry, MockIdentityStore } from '@uvrn/identity'`.
   - Backed by an **in-memory `MockIdentityStore`** instantiated per process — no external store.
   - Input: `{ address: string }`; Output: `ReputationScore | null`.

Peer deps in `uvrn-mcp/package.json`: add `@uvrn/drift`, `@uvrn/compare` (and `@uvrn/identity` if the
identity tool ships), each `>=1.0.0`; devDeps `workspace:*`. No circular deps.

**Master-receipt alignment:** where a tool result represents a measurement/relationship, return it in
a shape that can feed the master receipt (incl. node/source status when known) — not a bare number.

## Check

- `pnpm --filter @uvrn/mcp run build` + `run test` (vitest) green.
- Per-tool vitest handler tests: valid input, malformed input (returns the standard error envelope
  via `MCPError`/`ValidationError`), and boundary cases (e.g. compare with ≠2 claims throws cleanly).
- Confirm tools appear in `ListTools` and dispatch correctly.

## Update

- `uvrn-mcp/README.md`: document the new tools, their inputs/outputs, and the explicit-profile note.
- `uvrn-mcp/CHANGELOG.md`: minor bump.

## Reflect

- Note in `.admin/findings/` whether a `score-a-receipt` helper (DeltaReceipt → vScore+components via
  `@uvrn/score`) is common enough to warrant a documented pre-step or its own tool later.

## Continue

- Proceed to `DESIGN-mcp-config-model.md` **before** any stateful tool.

---

## MUST NOT include

- ❌ Any store/signer/provider or persisted state (identity uses in-memory mock only).
- ❌ `delta_score_claim`, canon, timeline, or watch tools (later phases).
- ❌ Hardcoded drift profile or domain default — profile is an explicit, documented input.
- ❌ Returning bare scores where a verifiable/measurement-shaped result is expected.
