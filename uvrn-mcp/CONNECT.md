# Connect to UVRN over MCP

`@uvrn/mcp` is a **client-neutral, local-first MCP server**. Any MCP-capable agent or app connects
to it the same way — by launching a **stdio** server and discovering its tools. It runs on a
**zero-external default path** (in-memory mocks, no API keys, no database), so it works on any
machine with nothing to sign up for.

It exposes **13 tools** (was 12 — migration note below):

`delta_run_engine`, `delta_validate_bundle`, `delta_verify_receipt`, `delta_score_drift`,
`delta_compare`, `delta_verify_identity`, `delta_canon_qualify`, `delta_canon_get`,
`delta_score_claim`, `delta_read_support`, `delta_report_rank_stability`,
`delta_validate_datapoint`, `delta_pattern_scan` — plus 4 resources and 3 prompts. The machine-readable contract is
[`plugin-manifest.json`](plugin-manifest.json) (the single source of truth for the tool surface).

**Migration (12 → 13):** Existing twelve tools are unchanged. Additive observatory tool
`delta_pattern_scan` (`@uvrn/pattern` `scanPatterns`) — detected ≠ verified; not receipt-class;
requires `joinScope` + `window` + host `history` (or injected `patternHistoryReader`). Clients that
hard-code a tool count of 12 should update discovery expectations; prior tool *names* stay stable.

**Prior migration (11 → 12):** Additive easy-verify tool `delta_validate_datapoint` (`@uvrn/validate`
Stage1 + optional Stage2 measure route) does **not** overload `delta_validate_bundle` (bundles ≠ DataPoints).

**Prior migration (9 → 11):** Two additive post-pipeline tools after `delta_score_claim`:
`delta_read_support` (lattice `readSupport` / claim ladder) and `delta_report_rank_stability`
(algox `reportRankStability`).

---

## Two launch forms

Every connector below uses one of these. Prefer **npx** — it has no machine-specific paths.

| Form | Command | When |
|---|---|---|
| **Published npm / stdio (recommended)** | `npx -y @uvrn/mcp` | Pulls the published package over **stdio**; nothing to clone, build, or peer-install. (“Online” here means npm — **not** a hosted remote MCP URL.) |
| **Local build** | `node <ABSOLUTE_PATH_TO_REPO>/uvrn-mcp/dist/index.js` | You cloned the repo and built `dist/` (below). |

> **No remote MCP URL today.** `@uvrn/mcp` speaks **stdio only** (`StdioServerTransport`). There is
> no SSE / Streamable HTTP / cloud MCP endpoint to paste into a connector. For HTTP access, use
> REST via `@uvrn/api` instead. Host your own stdio launcher (npx or local `node`) in the client.

> Replace `<ABSOLUTE_PATH_TO_REPO>` with the absolute path to your checkout. Never commit a real
> path into shared config — keep machine-specific wiring local.

---

## Build `dist/` for the local form

`dist/` is intentionally **not** committed. Build it once from the repo root:

```bash
pnpm install
pnpm --filter "@uvrn/mcp..." --config.verify-deps-before-run=false run build
```

The `@uvrn/mcp...` filter builds the server and its workspace dependencies, then bundles the
`@uvrn/*` runtime into `uvrn-mcp/dist/index.js`. The MCP SDK remains a normal npm dependency.
The packed tarball is tested in a clean directory with no separately installed `@uvrn/*` peers.

---

## Connectors

Ready-to-copy profiles live in [`connectors/`](connectors/). The server key is `uvrn` throughout.

### Claude Desktop
Open Claude Desktop's MCP settings file, merge the `mcpServers` block from
[`connectors/claude-desktop.json`](connectors/claude-desktop.json), then fully quit and relaunch the
app. To test an unpublished checkout, use the local-build launch form above in local config only.

### Cursor
Merge the `mcpServers` block from [`connectors/cursor.json`](connectors/cursor.json) into Cursor's
MCP settings (same npx shape as Claude Desktop). Restart MCP / reload the window so the `uvrn`
server appears. Project [`.mcp.json`](../.mcp.json) is a **local-build** profile for this checkout
after `dist/` exists — prefer the npx connector for third-party or zero-clone use.

### Claude Code (local agents)
A project-scoped [`.mcp.json`](../.mcp.json) at the repo root already registers `uvrn` with the
relative local-build path. Open the repo in Claude Code, approve the server when prompted (after
building `dist/`), and the 13 tools are available to local agents.

### Hermes (Nous Research)
Config file: `~/.hermes/config.yaml`. Merge the `mcp_servers` block from
[`connectors/hermes.config.yaml`](connectors/hermes.config.yaml), then run `/reload-mcp`. Hermes
prefixes tools as `mcp_uvrn_<tool>` (e.g. `mcp_uvrn_delta_run_engine`).

### Odysseus
Add a stdio MCP server via **Settings → Tools / MCP** (or `/setup`) using the npx form. See
[`connectors/odysseus.md`](connectors/odysseus.md).

### Any other MCP client
Point it at the stdio command (`npx -y @uvrn/mcp`, or `node …/dist/index.js`). The transport is
stdio; the contract is `plugin-manifest.json`.

---

## Environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `MAX_BUNDLE_SIZE` | `10485760` | Max bundle size in bytes (10 MB) |
| `STORAGE_PATH` | (none) | Optional receipt cache path |
| `VERBOSE_ERRORS` | `false` | Include stack traces in error responses |

### Maintainer-only (pipeline smoke scripts)

Not used by the default `npx -y @uvrn/mcp` stdio launch. Required for
[`scripts/pipeline-smoke-score-claim.mjs`](scripts/pipeline-smoke-score-claim.mjs),
[`scripts/pipeline-worker-sync-verify.mjs`](scripts/pipeline-worker-sync-verify.mjs), and
[`host/arcanum-host.mjs`](host/arcanum-host.mjs) when Arcanum persist is enabled.

| Variable | Required | Purpose |
|---|---|---|
| `UVRN_UMBRELLA` | **Yes** (maintainer scripts) | Absolute path to umbrella checkout (Arcanum `master.db`) |
| `UVRN_WORKER_URL` | No (defaults to prod worker) | Worker base URL for sync/read-back verify |
| `UVRN_WORKER_KEY` or `UVRN_API_KEY` | **Yes** (worker sync) | Bearer token for worker POST/GET — set in env, never commit |
| `UVRN_LOAD_KEY_FILE` | No (opt-in only) | Load worker key from a local file path; explicit opt-in, no baked-in paths |

---

## First call (after connect)

Have the agent call **`delta_score_claim`** with **host-provided `sources`** (the agent brings
evidence — two or more sources). That exercises the claim → measurement → MasterReceipt path
without requiring a farm connector or API keys. See the tool schema in
[`plugin-manifest.json`](plugin-manifest.json) and the package README for field details.

### Documented post-pipeline path

After `delta_score_claim`, hosts may invoke optional post-steps on the same MCP surface (no
duplicate engines — thin adapters over existing package APIs):

1. **`delta_score_claim`** — score the claim → MasterReceipt / V-Score  
2. **`delta_read_support`** — lattice `readSupport` / claim-ladder sufficiency (requires `claim` +
   `evidence`; pass `evidence: []` for an honest Unverified / empty-coverage readout)  
3. **`delta_report_rank_stability`** — algox `reportRankStability` ordering stability (requires a
   non-empty `candidates` array; default weight variants are an implementer PREP proposal, not
   product / publish law)

Default path needs **no auth tokens**. Do not invent `AUTH_TOKEN` / webhook secrets; those are
not required for the zero-external stdio launch.

---

## Verify the connection

Ask the connected agent: **"What UVRN tools are available?"** — expect the 13 `delta_*` tools.

To verify the server directly (no client), pipe an MCP handshake over stdin.

**Published npm (stdio):**

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | npx -y @uvrn/mcp
```

**Local-build (pre-publish / repo checkout):** build `dist/` first, then point `node` at the entry:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node <ABSOLUTE_PATH_TO_REPO>/uvrn-mcp/dist/index.js
```

A healthy server reports `delta-engine-mcp` v1.2.0 with `tools: 13, resources: 4, prompts: 3` and
returns the 13 tool names.

---

## Bring your own backends (advanced)

The server accepts injected runtime config via `createServer(runtimeConfig?)` — supply your own
`FarmConnector` (data sources), `CanonStore`, or `IdentityStore` to replace the in-memory defaults.
Omitted values fall back to the zero-external mocks. See the package README and `plugin-manifest.json`.
