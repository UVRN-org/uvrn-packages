# Build Plan — MCP Phase 5: Plugin Packaging (side doc)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/mcp` (LIVE) + plugin manifest
**Depends on**: Phases 1–4 validated
**Protocol**: Bloom v1.7
**Source**: report §6; architecture §6, §7

---

## Plan

Package the stabilized server for one-click installation as an agent plugin, while keeping the
distribution **open and client-agnostic**. The MCP server + a manifest = distributable UVRN access for
any compatible agent host.

## Build

1. Add a plugin manifest describing the server, its discoverable capabilities (tools, schemas,
   resources, prompts), and the generic connection command. Keep it client-neutral — Claude
   Desktop/Cowork is **one example host**, not the assumption.
2. Refresh the **prompt templates** (currently 3, pre-expansion) to cover the full tool surface and
   the 22+ package reality. Note `@uvrn/lattice` and `@uvrn/algox` postdate the original 20-package
   ROADMAP; update any "20 packages" copy.
3. Ensure the publish checklist holds: fresh `dist/` (gitignored), `files: ["dist","README.md","LICENSE"]`,
   semver deps (no `workspace:`), complete README with the **agnostic connection instructions** and
   minimal-install note, CHANGELOG entry, tarball smoke test.

## Check

- Clean install from tarball in an empty dir connects and lists the full capability set.
- A non-Claude stdio MCP client connects with no code change (proves agnostic packaging).
- `pnpm -r run build` and `pnpm -r run test` pass.

## Update

- `uvrn-mcp/README.md`: one-click install, the discovery/capability contract, "connect any agent here."
- `uvrn-mcp/CHANGELOG.md`: version bump.

## Reflect

- Capture packaging/distribution gaps in `.admin/findings/`.

## Continue

- Tool surface validated and distributable → MCP integration arc complete. Fold results into the
  master README and the architecture doc's MCP section.

---

## MUST NOT include

- ❌ A Claude-/vendor-/OS-specific install as the only documented path.
- ❌ Committing `dist/` or shipping `workspace:` deps.
- ❌ Hiding the discovery/capability contract — it must be explicit for any connecting agent.
