# npm publish 1.0.3 – report

**Date:** 2026-03-17  
**Scope:** All six @uvrn packages at version 1.0.3  
**Status:** Prep complete; publish requires one-time password (2FA) from maintainer.

## Summary

- **Version:** All packages set to 1.0.3 (package.json and CHANGELOGs).
- **Config:** Added `publishConfig.access: "public"` to every package for scoped public publish.
- **Packages:** Added explicit `files` (dist, README) to core, adapter, cli, api; sdk and mcp already had `files`.
- **Dependencies:** adapter, cli, api, mcp now use `@uvrn/core` with `workspace:^` so published manifest has `^1.0.3`.
- **Lockfile:** `pnpm-lock.yaml` updated for `workspace:^` specifiers.
- **Verification:** `pnpm install`, `pnpm run build`, `pnpm test`, and `pnpm audit --prod` all passed.

## Publish order (run from repo root)

npm 2FA is enabled; each publish will prompt for a one-time password, or you can pass `--otp=<code>`.

```bash
cd /path/to/uvrn-packages
pnpm --filter @uvrn/core publish --access public --no-git-checks
# When prompted, enter OTP or: ... --otp=XXXXXX
pnpm --filter @uvrn/sdk publish --access public --no-git-checks
pnpm --filter @uvrn/adapter publish --access public --no-git-checks
pnpm --filter @uvrn/cli publish --access public --no-git-checks
pnpm --filter @uvrn/api publish --access public --no-git-checks
pnpm --filter @uvrn/mcp publish --access public --no-git-checks
```

With OTP in one go (replace XXXXXX with current code):

```bash
OTP=XXXXXX
pnpm --filter @uvrn/core publish --access public --no-git-checks --otp=$OTP
pnpm --filter @uvrn/sdk publish --access public --no-git-checks --otp=$OTP
pnpm --filter @uvrn/adapter publish --access public --no-git-checks --otp=$OTP
pnpm --filter @uvrn/cli publish --access public --no-git-checks --otp=$OTP
pnpm --filter @uvrn/api publish --access public --no-git-checks --otp=$OTP
pnpm --filter @uvrn/mcp publish --access public --no-git-checks --otp=$OTP
```

## References

- Root [CHANGELOG.md](../../CHANGELOG.md) – [1.0.3] entry
- [2026-03-17-npm-publish-1.0.3-build-log.md](2026-03-17-npm-publish-1.0.3-build-log.md) – build log and next steps
