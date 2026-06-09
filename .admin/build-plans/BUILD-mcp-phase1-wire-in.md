# Build Plan — MCP Phase 1: Wire In & Validate (side doc)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/mcp` (LIVE)
**Depends on**: nothing (uses the existing 3 tools)
**Protocol**: Bloom v1.7
**Source**: `.admin/reports/report-mcp-integration-plan-2026-06-04.md` §1; architecture §6

---

## Plan

Build `@uvrn/mcp` locally and wire it into an MCP client to validate the three existing core tools
(`delta_run_engine`, `delta_validate_bundle`, `delta_verify_receipt`). No code changes. This is the
low-risk baseline before any expansion.

## Build

1. From the monorepo root, ensure workspace `node_modules` are installed so `@uvrn/core` resolves.
2. `pnpm --filter @uvrn/mcp run build` (fresh — `dist/` is gitignored; never trust an existing one).
3. Register the server with an MCP-compatible client. **Document the generic, agnostic form first**
   (any client), with Claude Desktop as one example:
   ```json
   { "mcpServers": { "uvrn": { "command": "node", "args": ["/abs/path/uvrn-mcp/dist/index.js"] } } }
   ```
   The server uses `StdioServerTransport` — the zero-config default. Note that any stdio MCP client
   connects the same way; nothing is Claude-specific.

## Check

- Client lists 3 tools, 4 resources, 3 prompts (matches `server.ts`).
- Run each tool against fixtures: a valid `DeltaBundle` → consensus/indeterminate receipt;
  `validate` on a malformed bundle → `valid:false`; `verify` on a known receipt → `verified:true`,
  and on a tampered receipt → `verified:false`.

## Update

- `uvrn-mcp/README.md`: add the generic "connect any MCP client" instructions (agnostic framing),
  the rebuild-first note, and the `@uvrn/core`-must-resolve prerequisite.

## Reflect

- Record runtime-resolution gotchas (e.g. core not found) in `.admin/findings/`.

## Continue

- Proceed to `BUILD-mcp-phase2-stateless-tools.md`.

---

## MUST NOT include

- ❌ Any new tool, store, signer, or provider.
- ❌ Treating a committed `dist/` as reliable — always rebuild.
- ❌ Claude-/OS-/vendor-specific assumptions as the default (Claude Desktop is one *example*).
