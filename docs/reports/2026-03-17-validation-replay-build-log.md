# Build log: Validation parity and replay timestamp policy

**Date:** 2026-03-17

## What was done

1. **Core**
   - Added `hashReceiptPayloadWithoutTs(payload)` in `uvrn-core/src/core/serialization.ts`; exported via existing `export * from './core/serialization'` in `index.ts`. Declared in `serialization.d.ts`.
   - Updated `uvrn-core/README.md` with “Validation (shared contract)” and “Replay determinism and timestamp” sections.
   - Created `uvrn-core/CHANGELOG.md` with 1.6.0 entry.

2. **SDK**
   - Refactored `validateBundle` in `uvrn-sdk/src/validators.ts` to delegate to core `validateBundle` and map `{ valid, error }` to SDK `{ valid, errors }`.
   - Updated `replayReceipt` to use normalized hash (payload without `ts`) for determinism; set `timestampNormalized` when only full hashes differ; extended `ReplayResult` in `uvrn-sdk/src/types/sdk.ts` with `timestampNormalized?: boolean`.
   - Implemented normalized hash locally in SDK (strip `ts`, call `hashReceipt`) so behavior does not depend on core export resolution at test runtime.
   - Added `uvrn-sdk/src/__tests__/validation-parity.test.ts` (fixtures: single_dataspec, threshold_zero, nan_metric, metric_missing_key, metric_non_number, valid_bundle).
   - Added replay timestamp matrix in `uvrn-sdk/src/__tests__/validators.test.ts`: receipt no ts / replay no ts; receipt no ts / replay with ts; receipt with ts / replay no ts; receipt with ts / replay with ts (same); outcome differs.
   - Adjusted existing validator and builder tests for delegated validation (expect `field === 'bundle'` where appropriate; two dataSpecs for valid bundles).
   - Updated `uvrn-sdk/README.md` and `uvrn-sdk/CHANGELOG.md` for 1.6.0.

3. **Root and reports**
   - Updated root `CHANGELOG.md` with 1.6.0 summary and links to package CHANGELOGs.
   - Added `docs/reports/2026-03-17-validation-replay-contract.md` and this build log.

4. **Versions**
   - Bumped `uvrn-core` to 1.6.0 and `uvrn-sdk` to 1.6.0 in `package.json` (see Version bumps below).

## Commands run

- `pnpm install && pnpm run build` — success.
- `pnpm run test` — all packages pass (including SDK parity and replay matrix).
- Pack and smoke: run `for dir in uvrn-core uvrn-sdk uvrn-adapter uvrn-mcp uvrn-api uvrn-cli; do (cd "$dir" && pnpm pack); done`, then `node scripts/check-packed-manifests.js`, then `pnpm run smoke:consumer` (recommended before publish).

## Key files

- `uvrn-core/src/core/serialization.ts` — `hashReceiptPayloadWithoutTs`
- `uvrn-core/src/core/serialization.d.ts` — declaration
- `uvrn-sdk/src/validators.ts` — delegate `validateBundle`, replay normalized hash + `timestampNormalized`
- `uvrn-sdk/src/types/sdk.ts` — `ReplayResult.timestampNormalized`
- `uvrn-sdk/src/__tests__/validation-parity.test.ts` — parity suite
- `uvrn-sdk/src/__tests__/validators.test.ts` — replay matrix + existing replay tests
- `uvrn-sdk/src/__tests__/builder.test.ts` — expect `field === 'bundle'`, two dataSpecs where needed
- `uvrn-core/README.md`, `uvrn-sdk/README.md` — validation and replay contract
- `uvrn-core/CHANGELOG.md`, `uvrn-sdk/CHANGELOG.md`, root `CHANGELOG.md` — 1.6.0 entries

## Good next steps

- Run full pack + `check-packed-manifests.js` + `smoke:consumer` before publishing.
- Publish in order: `pnpm --filter @uvrn/core publish --no-git-checks`, then `pnpm --filter @uvrn/sdk publish --no-git-checks` (and rest if versions are bumped).
- ADRs added: [0002-validation-source-of-truth.md](../decisions/0002-validation-source-of-truth.md), [0003-replay-determinism-timestamp-policy.md](../decisions/0003-replay-determinism-timestamp-policy.md).
- After publish, bump root README “Highlights” or “Recent” to mention 1.6.0 and behavior contract updates.
