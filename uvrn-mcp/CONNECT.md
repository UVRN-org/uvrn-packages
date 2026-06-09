# Connect to UVRN over MCP

`@uvrn/mcp` is a **client-neutral, local-first MCP server**. Any MCP-capable agent or app connects
to it the same way — by launching a **stdio** server and discovering its tools. It runs on a
**zero-external default path** (in-memory mocks, no API keys, no database), so it works on any
machine with nothing to sign up for.

It exposes **9 tools**:

`delta_run_engine`, `delta_validate_bundle`, `delta_verify_receipt`, `delta_score_drift`,
`delta_compare`, `delta_verify_identity`, `delta_canon_qualify`, `delta_canon_get`,
`delta_score_claim` — plus 4 resources and 3 prompts. The machine-readable contract is
[`plugin-manifest.json`](plugin-manifest.json) (the single source of truth for the tool surface).

---

## Two launch forms

Every connector below uses one of these. Prefer **npx** — it has no machine-specific paths.

| Form | Command | When |
|---|---|---|
| **Online (recommended)** | `npx -y @uvrn/mcp` | Pulls the published package; nothing to clone or build. |
| **Local build** | `node <ABSOLUTE_PATH_TO_REPO>/uvrn-mcp/dist/index.js` | You cloned the repo and built `dist/` (below). |

> Replace `<ABSOLUTE_PATH_TO_REPO>` with the absolute path to your checkout. Never commit a real
> path into shared config — keep machine-specific wiring local.

---

## Build `dist/` for the local form

`dist/` is intentionally **not** committed. Build it once from the repo root:

```bash
pnpm install
pnpm --filter "@uvrn/mcp..." --config.verify-deps-before-run=false run build
```

The `@uvrn/mcp...` filter builds the server **and its workspace dependencies** (all TypeScript, no
native steps). The `--config.verify-deps-before-run=false` flag sidesteps a pnpm v9+ gate that
otherwise fails on the optional `esbuild` build script used elsewhere in the monorepo. Entry point:
`uvrn-mcp/dist/index.js`. Run it in place — peers resolve via workspace symlinks.

---

## Connectors

Ready-to-copy profiles live in [`connectors/`](connectors/). The server key is `uvrn` throughout.

### Claude Desktop
Config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ·
`%APPDATA%\Claude\claude_desktop_config.json` (Windows) · `~/.config/Claude/claude_desktop_config.json` (Linux).
Merge the `mcpServers` block from [`connectors/claude-desktop.json`](connectors/claude-desktop.json),
then fully quit and relaunch the app.

> **Pre-publish note:** `connectors/claude-desktop.json` uses `npx`, which fetches the published
> package. To test this branch locally, replace `"command": "npx"` with `"command": "node"` and set
> `"args"` to the absolute path of `uvrn-mcp/dist/index.js` (after building `dist/`). Keep this local
> only — never commit machine-specific paths.

### Claude Code (local agents)
A project-scoped [`.mcp.json`](../.mcp.json) at the repo root already registers `uvrn` with the
relative local-build path. Open the repo in Claude Code, approve the server when prompted (after
building `dist/`), and the 9 tools are available to local agents.

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

---

## Verify the connection

Ask the connected agent: **"What UVRN tools are available?"** — expect the 9 `delta_*` tools.

To verify the server directly (no client), pipe an MCP handshake over stdin.

**Online (post-publish):**

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

A healthy server reports `delta-engine-mcp` v1.2.0 with `tools: 9, resources: 4, prompts: 3` and
returns the 9 tool names.

---

## Bring your own backends (advanced)

The server accepts injected runtime config via `createServer(runtimeConfig?)` — supply your own
`FarmConnector` (data sources), `CanonStore`, or `IdentityStore` to replace the in-memory defaults.
Omitted values fall back to the zero-external mocks. See the package README and `plugin-manifest.json`.
