# READY FOR CLAUDE CODE AUDIT

# Wave 4 Summary Report

**Date:** 2026-04-02
**Wave:** 4
**Packages:** `@uvrn/watch`, `@uvrn/embed`
**Status:** Built, audited, and remediated

## Summary table

| Package | Build | Tests | Notes |
|---------|-------|-------|-------|
| `@uvrn/watch` | ✅ | ✅ 10/10 | Callback-first alert routing, cooldowns, once/every modes, optional webhook/Slack/Discord examples |
| `@uvrn/embed` | ✅ | ✅ 8/8 | React component + zero-dependency UMD badge, in-memory cache, configurable `apiUrl`; phantom `@uvrn/core` dep removed after audit |

## Verification summary

- `pnpm --filter @uvrn/watch run build` — passed
- `pnpm --filter @uvrn/watch run test` — passed
- `pnpm --filter @uvrn/embed run build` — passed
- `pnpm --filter @uvrn/embed run test` — passed
- `pnpm --filter @uvrn/watch --filter @uvrn/embed run build` — passed
- `pnpm --filter @uvrn/watch --filter @uvrn/embed run test` — passed
- `pnpm install --no-frozen-lockfile` — required to refresh `pnpm-lock.yaml` after dependency removal

## Cross-package observations

- `pnpm install --no-frozen-lockfile` was required to register the two new workspaces and update `pnpm-lock.yaml`.
- `@uvrn/watch` consumes canonical drift threshold types from `@uvrn/drift` and does not redefine upstream event payloads.
- `@uvrn/embed` keeps its runtime provider-agnostic by taking a configurable `apiUrl`; the hosted API is only the default, not the requirement.
- Both packages preserve the zero-external path required by Bloom: `callback` for watch and standalone UMD for embed.

## Deviations from prompt

- `@uvrn/watch` unsubscribe behavior was broadened to accept either `subscriberId` or `claimId` because the prompt's examples and its internal subscription model conflicted.
- `@uvrn/embed` uses an internal shared runtime module so React and UMD paths stay behaviorally identical.

## Audit remediation

- `EMB-01` remediated: removed the phantom `@uvrn/core` dependency from `@uvrn/embed` and aligned package docs with the actual contract.
- `EMB-02`, `WCH-01`, `WCH-02`, and `META-01` were reviewed and accepted as non-blocking observations for v1.

## Recommendation

Ready for final audit sign-off.

Residual audit focus:

- Confirm the `@uvrn/watch` `claimId` fallback and unsubscribe semantics are the desired canonical behavior.
- Confirm the `@uvrn/embed` cache key should remain `claimId`-only even when different `apiUrl` values are used.
