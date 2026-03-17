# ADR 0002: Validation source of truth (Core)

## Context

Bundle validation was implemented in both @uvrn/core (used by the engine, API, MCP, CLI) and @uvrn/sdk (used by the SDK client and BundleBuilder). The rules diverged: core required at least two dataSpecs and thresholdPct > 0; SDK allowed a single dataSpec and thresholdPct ≥ 0, and did not check per-metric key/value or NaN. The same bundle could pass SDK validation and then fail at core (e.g. when running via API or after build), causing inconsistent behavior and production risk for audit and compliance workflows.

## Decision

- **Core is the single source of truth** for bundle validation. Protocol rules live in @uvrn/core (`validateBundle` in `uvrn-core/src/core/validation.ts`).
- **SDK delegates to core:** @uvrn/sdk `validateBundle` calls core `validateBundle` and maps the result into the SDK’s `ValidationResult` shape (e.g. `field: 'bundle'`, message from core). Pass/fail is identical across SDK, API, MCP, and CLI.
- **No duplicate rule sets:** Other packages (API, MCP, CLI) already use core for validation; SDK is the only consumer that needed to align by delegating instead of maintaining its own rules.
- **Parity tests:** A test suite runs identical fixtures through core and SDK and fails if outcomes differ, so regressions are caught in CI.

## Status

Accepted. Implemented in 1.6.0: SDK delegates to core; parity suite in `uvrn-sdk/src/__tests__/validation-parity.test.ts`. Breaking for callers that relied on previous looser SDK rules (single dataSpec, threshold=0, NaN/non-number metrics).
