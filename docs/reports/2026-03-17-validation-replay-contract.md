# Validation Parity and Replay Timestamp Contract

**Date:** 2026-03-17

## Summary

Implemented the validation parity and replay timestamp policy to fix two production-risk consistency issues: (1) bundle validation alignment between @uvrn/core and @uvrn/sdk, and (2) explicit, deterministic replay behavior around the optional `ts` field.

## What was implemented

### Validation parity

- **Source of truth:** Core protocol rules in `uvrn-core/src/core/validation.ts` are the single source of truth.
- **SDK:** `validateBundle` in `uvrn-sdk/src/validators.ts` now delegates to core `validateBundle` and maps core’s `{ valid, error }` to the SDK’s `{ valid, errors }` shape (field `'bundle'`, message from core).
- **Result:** Pass/fail is identical for all known mismatch cases: single dataSpec, threshold=0, NaN metric, missing metric key, non-number metric value. Parity test suite in `uvrn-sdk/src/__tests__/validation-parity.test.ts` runs identical fixtures through core and SDK and fails on any disagreement.

### Replay timestamp policy

- **Policy:** Replay determinism is defined as comparison of the **canonical receipt payload excluding the optional `ts` field**. Receipt integrity (`receipt.hash`) remains over the full payload.
- **Core:** Added `hashReceiptPayloadWithoutTs(payload)` in `uvrn-core/src/core/serialization.ts` and exported it for consumers that want normalized hashes.
- **SDK:** `replayReceipt` in `uvrn-sdk/src/validators.ts` uses a local normalized hash (payload without `ts`) for the determinism decision. When full hashes differ but normalized hashes match, `deterministic` is true and `timestampNormalized` is set on `ReplayResult`.
- **Tests:** Replay matrix tests in `uvrn-sdk/src/__tests__/validators.test.ts` cover: receipt no ts + replay no ts; receipt no ts + replay with ts; receipt with ts + replay no ts; receipt with ts + replay with ts (same); and outcome-differs (deterministic false).

### Docs

- Core and SDK READMEs updated with “Validation (shared contract)” and “Replay determinism and timestamp” (or equivalent). SDK README includes validation/replay contract and “why this matters” for audit/compliance.
- Core CHANGELOG (new file), SDK CHANGELOG, and root CHANGELOG updated for 1.6.0.

## Decisions

- **Validation:** Core as source of truth; SDK delegates and maps errors. No change to core validation logic.
- **Replay:** Option B — determinism compares canonical payload excluding `ts`; `timestampNormalized` indicates when the only difference was timestamp context.

## ADRs

- [ADR 0002: Validation source of truth (Core)](../decisions/0002-validation-source-of-truth.md)
- [ADR 0003: Replay determinism and timestamp policy](../decisions/0003-replay-determinism-timestamp-policy.md)

## Remaining / next steps

- ADRs added (see above).
- CI already runs tests (including parity and replay matrix); ensure pack-check runs after tests so regressions block the pipeline.
- Publish in dependency order: @uvrn/core 1.6.0, then @uvrn/sdk 1.6.0.
