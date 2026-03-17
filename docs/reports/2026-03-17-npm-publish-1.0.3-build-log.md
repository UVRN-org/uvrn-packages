# npm publish 1.0.3 – build log

**Date:** 2026-03-17

## What was done

1. **Package.json (all 6 packages)**  
   - Set `version` to `1.0.3`.  
   - Added `"publishConfig": { "access": "public" }`.  
   - **core:** Added `"files": ["dist", "README.md"]`.  
   - **adapter, cli, api, mcp:** Changed `"@uvrn/core": "workspace:*"` to `"@uvrn/core": "workspace:^"` in dependencies; added `"files": ["dist", "README.md"]` (mcp already had `files`).

2. **Lockfile**  
   - Ran `pnpm install --no-frozen-lockfile` to refresh `pnpm-lock.yaml` for the new `workspace:^` specifiers.

3. **CHANGELOGs**  
   - Root `CHANGELOG.md`: Added [1.0.3] section (npm publish readiness, publishConfig, files, workspace:^).  
   - `uvrn-sdk/CHANGELOG.md`: Added [1.0.3] entry and version table row.

4. **Pre-publish checks**  
   - `pnpm install`  
   - `pnpm run build` (all 6 packages)  
   - `pnpm test` (all suites passed)  
   - `pnpm audit --prod` (no known vulnerabilities)

5. **Publish**  
   - Publish was attempted; npm returned `EOTP` (one-time password required).  
   - Maintainer must run the publish commands with 2FA code; see [2026-03-17-npm-publish-1.0.3.md](2026-03-17-npm-publish-1.0.3.md).

## Good next steps

- Run the six `pnpm --filter <pkg> publish ...` commands from repo root with your OTP (see report above).  
- After publish: verify on [npm @uvrn](https://www.npmjs.com/settings/uvrn/packages) that all six packages show 1.0.3.  
- Optional: tag release in git, e.g. `git tag v1.0.3 && git push origin v1.0.3`.  
- Optional: smoke-test install, e.g. `npm install @uvrn/core@1.0.3 @uvrn/sdk@1.0.3` in a temp directory.
