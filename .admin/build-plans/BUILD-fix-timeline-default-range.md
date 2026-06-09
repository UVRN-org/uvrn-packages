# Build Plan — Fix `@uvrn/timeline` default-range test failures

**Package**: `@uvrn/timeline` (pre-release — not yet on npm)
**Depends on**: nothing
**Severity**: Major — blocks the workspace test gate (`pnpm -r run test`), which blocks all publishing.
**Relationship to this build**: SEPARATE from trend-engine-layer-v1. Pre-existing, unrelated bug —
plan and execute it on its own; do not fold into the measurement/master-receipt work.
**Protocol**: Bloom v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Source**: surfaced by the npm-readiness audit (`.admin/audits/audit-npm-readiness-2026-06-04.md`)

---

## Plan

Two `@uvrn/timeline` tests fail. Root cause is a **time-bomb test**, not broken timeline logic. Fix
the tests so they are time-independent, without changing shipped behavior.

## Diagnosis (verified)

- Failing tests (`uvrn-timeline/tests/timeline.test.ts`):
  - `chart() includes canonMarkers at the nearest indices` — `:94-95` (expects 1 canon marker, gets 0)
  - `summary is non-empty and LLM-friendly` — `:115-116` (expects "1 canonization event", gets
    "Claim clm_timeline has no timeline snapshots in the requested range.")
- Both call `timeline.query('clm_timeline')` **with no `from`/`to`**. The passing count/resolution
  tests pass explicit dates and are unaffected.
- Cause — `uvrn-timeline/src/timeline/Timeline.ts`, `toIsoRange()` (`:31-44`):
  ```ts
  const to   = options.to   ?? new Date().toISOString();                    // defaults to NOW
  const from = options.from ?? new Date(toMs - 30 * 24 * 60 * 60 * 1000)... // NOW − 30 days
  ```
  The default window is "last 30 days from the real clock." Fixtures are dated **2026-04-01/02**; the
  clock is now **2026-06-05**, so April falls outside the window and is filtered out. The tests passed
  when "now" was April 2026 and rotted as the clock advanced.

## Build (the fix — preferred, no runtime behavior change)

Make the two failing tests time-independent by passing an explicit range, as the count/resolution
tests already do:
```ts
const result = await timeline.query('clm_timeline', {
  from: '2026-04-01T00:00:00.000Z',
  to:   '2026-04-03T00:00:00.000Z',
});
```
Apply to both the `canonMarkers` and `summary` tests. Shipped default-window semantics stay unchanged.

**Acceptable alternative** (only if clock-independent fixtures are preferred): freeze time in the test
(e.g. `jest.setSystemTime(new Date('2026-04-03'))`) so the default 30-day window covers the fixtures.
Pick one approach; do not mix.

## Check

- `pnpm --filter @uvrn/timeline run test` — all 7 green.
- `pnpm -r run test` — workspace gate green (unblocks the publish checklist).

## Update

- `uvrn-timeline/CHANGELOG.md` — note the test fix (no API/behavior change).

## Reflect

- Log in `.admin/findings/` that fixed-date fixtures + a now-relative default window are a recurring
  time-bomb pattern; recommend frozen-clock tests as a house convention for any time-windowed package.

## Continue

- Once green, the workspace test gate passes and the npm-readiness blocker for item 9 clears.

---

## MUST NOT include

- ❌ Widening or changing the production default range in `toIsoRange()` to make a test pass — that
  alters shipped behavior for every consumer.
- ❌ Fixtures relative to `Date.now()` that reintroduce clock-dependence.
- ❌ Touching the storage/filter logic — `getSnapshots`/`getCanonEvents` (`:84-96`) are correct; the
  range inputs were the problem.
