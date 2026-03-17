# Loosechain → UVRN brand replacement – report

**Date:** 2026-03-17  
**Scope:** uvrn-packages monorepo  
**Status:** Complete.

## Summary

- Replaced all user-facing and documentation references to the retired "Loosechain" brand with "UVRN" across the monorepo.
- No package names, npm scope (`@uvrn/*`), or functional logic were changed—brand string replacement only.
- Build and tests: `pnpm run build` and `pnpm test` completed with zero errors.

## Packages and files updated

| Package       | Files |
|--------------|--------|
| **uvrn-cli** | `src/cli.ts`, `src/index.ts`, `tests/cli.test.ts`, `docs/CLI_GUIDE.md` |
| **uvrn-core** | `src/index.ts`, `src/index.js`, `src/index.d.ts`, `src/types/index.ts`, `src/types/index.js`, `src/types/index.d.ts` |
| **uvrn-adapter** | `src/index.ts` |
| **uvrn-sdk** | `src/index.ts`, `LICENSE` |
| **uvrn-mcp** | `delta-engine-mcp.json`, `CLAUDE_DESKTOP_SETUP.md`, `ENVIRONMENT.md` |

**@uvrn/api:** No Loosechain references found; no changes.

## References

- Build log: [2026-03-17-loosechain-to-uvrn-build-log.md](2026-03-17-loosechain-to-uvrn-build-log.md)
- Build discipline: [.cursor/rules/build-discipline.mdc](../../.cursor/rules/build-discipline.mdc)
