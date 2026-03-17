# Loosechain → UVRN brand replacement – build log

**Date:** 2026-03-17

## What was done

1. **Brand string replacements**  
   All occurrences of "Loosechain" / "loosechain" were replaced with "UVRN" in:
   - **uvrn-cli:** Program description and file headers in `src/cli.ts`, `src/index.ts`; test assertion in `tests/cli.test.ts`; title and body text in `docs/CLI_GUIDE.md`.
   - **uvrn-core:** File headers in `src/index.ts`, `src/index.js`, `src/index.d.ts`, and `src/types/index.ts`, `src/types/index.js`, `src/types/index.d.ts`.
   - **uvrn-adapter:** File header in `src/index.ts` ("Loosechain UVRN Adapter" → "UVRN Adapter").
   - **uvrn-sdk:** Package doc comment in `src/index.ts`; copyright line in `LICENSE` ("Loosechain / Suttle Media LLC" → "UVRN / Suttle Media LLC").
   - **uvrn-mcp:** `delta-engine-mcp.json` (description and author); tagline in `CLAUDE_DESKTOP_SETUP.md` and `ENVIRONMENT.md`.

2. **Build and tests**  
   - `pnpm run build` — all 6 workspaces built successfully.  
   - `pnpm test` — all suites passed (core, sdk, cli, api, mcp, adapter).

3. **Build-discipline**  
   - Root [CHANGELOG.md](../../CHANGELOG.md): Added entry under [Unreleased] → Changed.  
   - [uvrn-sdk/CHANGELOG.md](../../uvrn-sdk/CHANGELOG.md): Added [Unreleased] → Changed.  
   - Report: [2026-03-17-loosechain-to-uvrn-brand.md](2026-03-17-loosechain-to-uvrn-brand.md).

## Good next steps

- Commit with message: `chore: replace retired Loosechain brand with UVRN across all packages`.
- If you maintain **uvrn-packages-next**, run the same replacement sweep there (including uvrn-agent, uvrn-drift, uvrn-canon LICENSE files) and run that repo’s build.
- When cutting a release that includes this change, tag and publish per the usual publish order (core first, then sdk/adapter, then cli/api/mcp).
