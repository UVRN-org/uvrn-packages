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

- **Publish to npm**: Not completed. `pnpm --filter @uvrn/core publish --access public` was run and failed with:
  - `404 Not Found - PUT https://registry.npmjs.org/@uvrn%2fcore` — "you do not have permission to access it" or scope not found.
- **Prerequisite**: npm account with access to publish under **@uvrn** scope, and logged in locally (`npm whoami`; `npm login` or token). Once auth/scope is in place, publish in this order:
  1. `pnpm --filter @uvrn/core publish --access public`
  2. `pnpm --filter @uvrn/sdk publish --access public`
  3. `pnpm --filter @uvrn/adapter publish --access public`
  4. `pnpm --filter @uvrn/mcp publish --access public`
  5. `pnpm --filter @uvrn/api publish --access public`
  6. `pnpm --filter @uvrn/cli publish --access public`

## Remains

- Complete npm auth and @uvrn scope setup; run the six publish commands above.
- Optionally add `CHANGELOG.md` to other packages (core, adapter, mcp, api, cli) for 1.0.0 when they are first published.
- Any follow-up (e.g. Node/adapter consumer update to use published packages) per Lyrikai Node or other consumers.
