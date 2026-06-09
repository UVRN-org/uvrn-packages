# BUILD — UVRN Connectors & Distribution (client-neutral MCP product)

**Status:** Phase 1 implemented (connector layer + docs). Publish = design-only, deferred.
**Date:** 2026-06-08
**Owner:** Claude Code (protocol/integration lead)
**Bloom:** Plan → **Build** → Check → Update → Reflect → Continue

---

## Why

UVRN must function as a **pure, public-facing, client-neutral MCP product** that any LLM or local
system can connect to and use — choosing whichever of the 9 tools it needs. Priority 1 is local
agents using UVRN as a system; simultaneously the *same* server must adapt to any consumer. The
three standard reference connectors are **Claude Desktop, Hermes, Odysseus**.

### Pure-product principle (non-negotiable)
Everything committed/published is **machine-agnostic** — no personal absolute paths, no `~/Library`
configs, no usernames. The local machine is for **testing builds only**; machine-specific wiring
stays local and uncommitted. UVRN is designed and pushed as an unconnected "pure" system *before*
being attached to any specific machine.

---

## Key architecture — one server, thin connectors

All three target clients connect a **stdio** MCP server via a launch command; only the config
file/format differs. So the product is **one pure server + thin per-client connector profiles**,
not N integrations.

| Client | Config | Format |
|---|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | JSON `mcpServers` |
| Claude Code | repo-root `.mcp.json` | JSON `mcpServers` (relative path) |
| Hermes | `~/.hermes/config.yaml` | YAML `mcp_servers`; tools prefixed `mcp_uvrn_*`; `/reload-mcp` |
| Odysseus | in-app Settings / `/setup` | npx-cached stdio |

**Universal launch forms:** `npx -y @uvrn/mcp` (pure/online) · `node <ABS>/uvrn-mcp/dist/index.js` (local).

> **Terminology guard:** these are *client connector profiles* (host integrations) — distinct from
> UVRN's `FarmConnector` (data-source) concept.

---

## Phase 1 — implemented this build

- `uvrn-mcp/connectors/claude-desktop.json`, `hermes.config.yaml`, `odysseus.md` — machine-agnostic,
  npx-first, server key `uvrn`.
- Repo-root `.mcp.json` (relative path) → Claude Code local agents connect on clone.
- `uvrn-mcp/CONNECT.md` — client-neutral connect guide (two launch forms, all 3 + generic, 9 tools,
  bootstrap, verify handshake, runtime-config injection).
- Retired the stale Claude Desktop setup guide and the legacy 3-tool manifest (both superseded).
  **`plugin-manifest.json` is the single source of truth** for the tool surface.
- `uvrn-mcp/package.json` `files` now ships `CONNECT.md` + `connectors/` in the npm tarball.
- Repointed doc links in `uvrn-mcp/README.md` and `ENVIRONMENT.md` to `CONNECT.md`.

Turnkey local build (handles the pnpm v9+/esbuild ignored-builds gate; `dist/` stays uncommitted):
```bash
pnpm install
pnpm --filter "@uvrn/mcp..." --config.verify-deps-before-run=false run build
```

---

## npm / npx readiness — DESIGN (not executed this phase)

**Blocker:** `@uvrn/mcp` declares its 9 `@uvrn/*` links as **peerDependencies** (CLAUDE.md rule #5).
`npx @uvrn/mcp` does **not** auto-install peerDependencies, so the zero-config online path needs a
deliberate strategy.

### Open decision D1 — how npx resolves mcp's `@uvrn/*` code
- **Bundle (recommended):** add a bundler step so the published `dist` embeds its `@uvrn/*` code.
  npx works with zero peer installs; **keeps rule #5** (peers stay dev-only). Publish set for the
  npx path shrinks to just `@uvrn/mcp`. Cost: add esbuild/tsup build; embeds dep copies.
- **peer → deps:** make the 9 links real `dependencies`. Simplest config change, but **violates
  rule #5** (needs a documented exception for the app package) and requires the full runtime
  closure published at compatible versions first.
- **document-install:** keep peers, tell users to install the set. Worst UX — not "any system just
  connects."

### Open decision D2 — local download channel
`npm install @uvrn/mcp` (no public repo needed) vs a **public mirror repo** vs npm-only.

### Publish set & order (for the eventual all-23 MVP release)
- **Empirical mcp runtime closure** = the 13 packages built by `pnpm --filter "@uvrn/mcp..."`:
  core, score, drift, agent, canon, test, compare, identity, farm, measure, normalize, consensus,
  mcp. (`algox`, `lattice`, `signal`, `sdk`, `adapter`, `api`, `cli`, `watch`, `embed` are **not**
  in the mcp compile closure — verify any claimed core↔algox/lattice wiring before publishing core.)
- **Currently unpublished:** `@uvrn/measure`, `@uvrn/lattice`, `@uvrn/algox` (3 of 23, 404 on npm
  as of 2026-06-08).
- **Version divergence (publish blocker):** this branch is **behind** npm — local `core` 1.1.0 /
  `mcp` 1.2.0 vs published `core` 1.6.1 / `mcp` 1.5.4 (2026-06-08). Reconcile semver (and confirm
  whether the branch changes are a subset already shipped or a divergent lineage) before publishing.
- **Order** (if D1 = peer→deps): publish leaves → core → … → mcp last; see README "Publish order".
  If D1 = bundle: only the packages a consumer imports directly need publishing for the MCP path.
- Standard publish checklist still applies: `workspace:*` → semver (19 manifests), `@uvrn/timeline`
  default-range test fix, tarball smoke test, `files` correctness.

---

## Out of scope (deferred phases)
Actual `npm publish` · HTTP/SSE transport · browser dashboards · REST API · any committed
machine-specific wiring.

## Remaining cleanups (logged, not blocking)
- Loosechain footer/branding in `uvrn-mcp/ENVIRONMENT.md` (and any siblings).
- Dangling links in `uvrn-mcp/README.md` (`../../docs/MCP_INTEGRATION.md`, `phase_a3_task_list.md`).
- `handlers.ts` header comment says "three core tools" (implements nine).
- Root `CLAUDE.md` still says "20 packages" (now 23).

## Verification (this phase)
- **Purity gate:** grep all new/changed artifacts for absolute paths, `~/Library`, the author's
  username — must be zero.
- **Connector validation (local, uncommitted):** spawn via each profile; confirm 9 `delta_*` tools.
- **`.mcp.json`:** relative-path launch from a fresh checkout returns 9 tools after bootstrap.
