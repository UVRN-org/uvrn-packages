# UVRN connector for Odysseus

[Odysseus](https://odysseusai.org/) is a self-hosted, local-first AI workspace whose agents can
connect **any MCP server**. It auto-registers a few built-in MCP servers at startup and runs
**npx-based stdio servers** on demand (the same model it uses for `@playwright/mcp`). UVRN's npx
launch form drops straight into that model.

## Add UVRN (recommended — npx)

1. Make sure the package is in the local npx cache (Odysseus only auto-starts npx servers that are
   already cached):

   ```bash
   npx -y @uvrn/mcp --help >/dev/null 2>&1 || npx -y @uvrn/mcp &
   ```

2. In Odysseus, open **Settings → Tools / MCP** (or run `/setup`) and add a stdio MCP server:

   - **Name:** `uvrn`
   - **Command:** `npx`
   - **Args:** `-y @uvrn/mcp`
   - **Env (optional):** `LOG_LEVEL=info`

3. Reload tools in Odysseus. The agent can then call UVRN's 9 tools as it chooses
   (`delta_run_engine`, `delta_score_claim`, …). The zero-external default path needs no API keys.

## Local-build variant

If you cloned the repo instead of installing from npm, point Odysseus at the built entry instead:

- **Command:** `node`
- **Args:** `<ABSOLUTE_PATH_TO_REPO>/uvrn-mcp/dist/index.js`

See [`../CONNECT.md`](../CONNECT.md) for the one-command build that produces `dist/`.
