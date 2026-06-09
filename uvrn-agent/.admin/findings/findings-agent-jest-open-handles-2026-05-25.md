---
name: findings-agent-jest-open-handles-2026-05-25
description: Jest --forceExit warning in @uvrn/agent test suite — open handles not cleaned up after tests
metadata:
  type: finding
  severity: low
  package: "@uvrn/agent"
  date: 2026-05-25
  introduced_by: pre-existing (not introduced by sync)
  status: open
---

# Finding: Jest `--forceExit` Open Handles — `@uvrn/agent`

## Observed

During the LIVE → LIVE-BUILDS-PRIVATE sync verification run (2026-05-25), the `@uvrn/agent` test suite passed (7/7) but Jest emitted a warning about open handles:

> Jest did not exit one second after the test run has completed. This usually means that there are asynchronous operations that weren't stopped in your tests. Consider running Jest with `--detectOpenHandles` to troubleshoot this issue.

The suite is currently configured with `--forceExit` to suppress this, which masks the underlying cause.

## Classification

- **Severity:** Low
- **Pre-existing:** Yes — not introduced by the drift/consensus sync
- **Blocking:** No — tests pass and the published package is unaffected at runtime

## Likely cause

Async operations in `@uvrn/agent` tests (timers, unresolved promises, or open network/stream handles) that are not cleaned up in `afterEach` / `afterAll`. The `--forceExit` flag forces Jest to terminate rather than wait for the event loop to drain.

## Risk

Low now, but `--forceExit` can mask real resource leaks that surface as flakiness in CI or in downstream test suites that share a process. If `@uvrn/agent` tests are ever parallelized or run alongside integration tests, open handles can cause non-deterministic failures.

## Recommended fix

1. Run `jest --detectOpenHandles` in `uvrn-agent/` to identify the specific handle
2. Add `afterAll(() => { /* cleanup */ })` for any timers, intervals, or open connections
3. Remove `--forceExit` once the handles are clean

## References

- Observed during: LIVE-BUILDS-PRIVATE sync verification, step 4 (agent + canon smoke check)
- Audit report: `LIVE-BUILDS-PRIVATE/.admin/audits/` (sync audit 2026-05-25)
