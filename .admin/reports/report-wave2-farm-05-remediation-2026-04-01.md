# Wave 2 FARM-05 Remediation Report

**Date:** 2026-04-01
**Wave:** 2
**Package:** `@uvrn/farm`
**Issue:** FARM-05
**Status:** Remediated and verified

## Summary

Applied a narrow internal refactor to remove runtime `PROFILES` imports from `@uvrn/agent` in the string-overload fallback path used by `BaseConnector` and `MultiFarm`.

The fallback logic now uses one internal helper that returns a `ClaimRegistration` with a local `DriftProfile` literal matching the previous `PROFILES.default` semantics.

## Files changed

- `uvrn-farm/src/internal/defaultClaimRegistration.ts`
- `uvrn-farm/src/connectors/base/BaseConnector.ts`
- `uvrn-farm/src/multi/MultiFarm.ts`
- `.admin/build-plans/WORKSTREAMS.md`

## Commands run

- `pnpm --filter @uvrn/farm run build`
- `pnpm --filter @uvrn/farm run test`
- `pnpm --filter @uvrn/farm --filter @uvrn/normalize run build`
- `pnpm --filter @uvrn/farm --filter @uvrn/normalize run test`

## Verification results

- `pnpm --filter @uvrn/farm run build` — passed
- `pnpm --filter @uvrn/farm run test` — passed
- `pnpm --filter @uvrn/farm --filter @uvrn/normalize run build` — passed
- `pnpm --filter @uvrn/farm --filter @uvrn/normalize run test` — passed

## Remediation details

- Removed the `PROFILES` value import from `uvrn-farm/src/connectors/base/BaseConnector.ts`
- Removed the `PROFILES` value import from `uvrn-farm/src/multi/MultiFarm.ts`
- Centralized fallback claim construction in one internal helper to avoid duplicated literals
- Matched the previous fallback behavior with a local `DriftProfile` literal:
  - `name: 'default'`
  - `curve: 'LINEAR'`
  - `rate: 0.15`
  - `staleAfterHours: 720`
  - `scoreFloor: 0`

## Public API impact

None.

- No package manifest changes
- No export map changes
- No README or CHANGELOG changes
- No public symbols added or removed
