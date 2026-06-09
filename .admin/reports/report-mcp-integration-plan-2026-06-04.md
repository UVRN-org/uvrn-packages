# MCP Integration Plan — @uvrn/mcp
**Date**: 2026-06-04
**Revised**: 2026-06-04 (corrections applied after assessment)
**Author**: Claude Cowork
**Status**: Planning — not yet wired in

---

## Diagnosis

### What exists

`@uvrn/mcp` is a fully built, locally runnable MCP server. No deployment, no hosted API, and no external service is required — it runs in-process over stdio, communicating directly with `@uvrn/core`.

Note: `dist/` is gitignored and must not be treated as a durable artifact. Before wiring in, a fresh `pnpm run build` inside `uvrn-mcp/` is required to produce a reliable local build.

It exposes three tools to any MCP-compatible AI client:

- `delta_run_engine` — submit a `DeltaBundle`, receive a `DeltaReceipt` with V-Score and consensus outcome
- `delta_validate_bundle` — validate a bundle's structure before running
- `delta_verify_receipt` — verify a receipt's hash integrity (tamper detection)

It also ships three prompt templates (`verify_data`, `create_bundle`, and a third) and four resource URIs for schema introspection.

### What it does NOT do yet

The current implementation is scoped to `@uvrn/core` only — it runs the delta engine and validates/verifies receipts. It does not expose:

- Drift scoring (`@uvrn/drift`) — no `delta_get_drift` or `delta_score_decay` tool
- Farm connectors (`@uvrn/farm`) — no live data fetching
- Canon records (`@uvrn/canon`) — no canonization or lookup
- Timeline queries (`@uvrn/timeline`) — no history
- Watch subscriptions (`@uvrn/watch`) — no threshold alerts via MCP
- Signal bus (`@uvrn/signal`) — not wired

This means the current MCP surface is the engine core only — enough to verify pre-built bundles, but not enough to have a full "give Claude a claim, get back a live score" loop.

### Current transport

Uses `StdioServerTransport` — the standard local MCP pattern. Claude Desktop connects to it as a child process. This is correct and simple.

---

## Ideas

### 1. Wire it in now (minimal, low-risk)

Build locally first, then add to `claude_desktop_config.json`:

```bash
cd uvrn-mcp && pnpm run build
```

```json
{
  "mcpServers": {
    "uvrn": {
      "command": "node",
      "args": ["/path/to/uvrn-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. This gives access to the three core tools immediately — verifying pre-built bundles, checking receipt integrity, testing the V-Score engine directly in conversation.

**Risk**: Low. No storage, no network calls. Worst case: the server crashes and Claude falls back to normal behavior.

**Prerequisite check**: `@uvrn/core` must be resolvable at runtime. Running from the monorepo root with workspace `node_modules` in place is the simplest path. Verify before wiring in.

### 2. Expand with stateless tools only (Phase 2)

The first expansion should be limited to tools that require no stores, no signers, no providers, and no long-lived runtime state. Three candidates:

| Tool | Package | Why stateless |
|---|---|---|
| `delta_score_drift` | `@uvrn/drift` | Takes a receipt + timestamp, returns decayed score — pure computation |
| `delta_compare` | `@uvrn/compare` | Takes two receipts, returns delta + divergence — pure computation |
| `delta_verify_identity` | `@uvrn/identity` | Acceptable only if backed by a `MockIdentityStore` (in-memory) — no external store required |

Each follows the same handler pattern already in `tools/handlers.ts` — small lift. Drift and compare are the priority; identity is optional in Phase 2 depending on whether an in-memory registry is sufficient.

**Do not include in Phase 2**: timeline, canon, watch, or `delta_score_claim`. These all require configuration (stores, signers, providers, or persistent agent state) that hasn't been defined for the MCP context yet.

### 3. Define the MCP config model (prerequisite for Phase 3+)

Before adding stateful or provider-backed tools, the MCP server needs a config model — a way to specify which stores, signers, and connectors are active for this instance. This could be environment variables, a config file, or a startup argument. Without this, there's no safe way to add canon, timeline, or farm tools without hardcoding choices that violate the provider-agnostic standard.

This is a design task, not a build task. Define it before writing Phase 3 handlers.

### 4. Canon exposure (Phase 3 — after config model exists)

Canon must respect the protocol rule: **no auto-canonization**. MCP exposure should follow the same constraint. The right flow is:

- `delta_canon_qualify` — assess whether a receipt is a good canonization candidate (suggest flow)
- `delta_canon_get` — retrieve an existing canon record by ID

`delta_canonize` (the actual write) requires explicit user confirmation and should be treated with the same care as a destructive operation. Do not expose it until the confirmation model is clear.

### 5. Farm-powered live scoring (Phase 4 — after config model + provider-agnostic design)

A `delta_score_claim(claim: string) → DeltaReceipt` tool is the most marketable demo but has the most moving parts. When it's built:

- The tool must accept a `connectors` config, not default to `CoinGeckoFarm`. CoinGecko is a valid reference/example connector, not the protocol default.
- The pipeline is: connectors → `@uvrn/normalize` → `@uvrn/consensus` → `@uvrn/core` → receipt.
- Provider-agnostic by design: a user with a private data feed should be able to swap connectors without touching the tool logic.

### 6. Plugin packaging (Phase 5)

Once the server is stable and the tool surface is validated, package as a Cowork/Claude Code plugin for one-click installation. The MCP server + plugin manifest = distributable UVRN access for any Claude Desktop user.

---

## Recommended sequence

1. **Phase 1** — Build locally, wire into Claude Desktop, validate the three existing tools.
2. **Phase 2** — Add stateless tools: `delta_score_drift`, `delta_compare`, optionally `delta_verify_identity` with mock store.
3. **Phase 3 prerequisite** — Define the MCP config model (stores, signers, connectors). No stateful tools before this exists.
4. **Phase 3** — Add canon qualify/get flows. No auto-canonize.
5. **Phase 4** — Add `delta_score_claim` with provider-agnostic connector config. CoinGeckoFarm as reference only.
6. **Phase 5** — Plugin packaging for distribution.

---

## Notes / open questions

- `dist/` is gitignored. Always run `pnpm run build` fresh before wiring in or sharing. Do not treat any existing `dist/` as reliable.
- `@uvrn/core` must be resolvable at runtime. Running from the monorepo root with workspace `node_modules` is simplest. Verify before first run.
- Storage-backed resources (`mcp://delta-engine/receipts/{uvrn}`, `mcp://delta-engine/bundles/{id}`) are stubbed — noted as "not yet implemented in Phase A.3." Not a blocker for Phase 1–2, but relevant when canon and timeline tools arrive.
- The repo now has 22 packages including `@uvrn/lattice` and `@uvrn/algox`, which postdate the original 20-package ROADMAP. Any reference to "20 packages" in older docs is stale. If these packages get MCP exposure, prompt templates should be updated accordingly.
- The three prompt templates are pre-`lattice`/`algox` and pre-expanded tool surface. They're fine for Phase 1 but will need revision as the tool list grows.

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
*Claude Cowork — research and planning*
