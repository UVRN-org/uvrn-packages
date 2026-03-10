# Report: UVRN NPM first publish

**Date**: 2026-03-08  
**Scope**: [uvrn-packages](/Users/stsdev1/Documents/SuttleMedia/SuttleMediaLLC/UVRN/uvrn-packages)  
**Plan**: UVRN NPM first publish (dependency order, 1.0.0)

---

## Done

- **Build**: `pnpm run build` succeeded for all six workspace packages (core, sdk, adapter, mcp, api, cli).
- **Versions**: All six `package.json` files have `"version": "1.0.0"` (core, sdk, adapter, mcp, api, cli).
- **Docs**: Root README updated to reference first-publish report; `uvrn-sdk/CHANGELOG.md` updated with first public npm release note for 1.0.0.
- **Report**: This file added under `docs/reports/` per build-discipline.

## Publish status

- **Publish to npm**: Completed. All six packages were successfully published at **1.0.0** in dependency order (core, sdk, adapter, mcp, api, cli). See [npm @uvrn packages](https://www.npmjs.com/settings/uvrn/packages).

## Remains

- Optionally add `CHANGELOG.md` to other packages (core, adapter, mcp, api, cli) for 1.0.0.
- **Next step**: Point Lyrikai Node `adapters/uvrn-ledger` at `@uvrn/core` and `@uvrn/sdk` (Node plan: uvrn-ledger adapter deps).
