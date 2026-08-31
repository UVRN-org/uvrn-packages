# UVRN Packages — Agent Context (public repo)

**GitHub remote:** [`UVRN-org/uvrn-packages`](https://github.com/UVRN-org/uvrn-packages) — PRs land on **`main`**.

This is the UVRN protocol monorepo for the **public** generation:
33 `@uvrn/*` workspace packages plus the protocol specifications in `SPEC/`.

**Cursor / Claude agents:** this file.  
**Read book + article / how to speak results:** [`agents/SCRIBE.md`](agents/SCRIBE.md) (index: [`agents/README.md`](agents/README.md)).  
**External / 3rd-party MCP clients** (connectors, online agents): [`uvrn-mcp/CONNECT.md`](uvrn-mcp/CONNECT.md) — not this file.

**Org / protocol home:** [`UVRN-org/uvrn`](https://github.com/UVRN-org/uvrn).  
**Previous public generation:** branch `legacy/v4-main` on this repo.

## Build & test

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm run check:phase1-gates
```

pnpm ≥ 11.5 note: packages with build scripts must be approved via `allowBuilds` in the
workspace config (already set — `onlyBuiltDependencies` alone is not sufficient).

## Binding laws (do not violate)

1. **Additive-only against live receipts.** Golden vectors in `SPEC/` must keep passing byte-identically.
2. **Honest vocabulary.** Integrity-checked ≠ verified without a valid producer signature.
3. **In-repo dependencies use `workspace:^`** so publishing rewrites them to the released version range.

## Layout

- `uvrn-*/` — one package each; `src/` TypeScript, `dist/` build output.
- `SPEC/` — protocol specs + golden test vectors.
- `agents/` — agent how-to. Start at [`agents/SCRIBE.md`](agents/SCRIBE.md).

See `CONTRIBUTING.md` for the PR workflow.
