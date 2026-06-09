# Changelog

## 2.0.0

- Integrated `@uvrn/algox` into the LIVE UVRN workspace package system.
- Applied v2 remediation for invalid dates, non-finite numeric fields, partial
  weight defaults, strongest-wins URL deduplication, hostname source fallback,
  host prefix normalization, whitespace label validation, and unsafe knob guards.
- Added focused edge-case coverage for remediation behavior.
- Updated docs and package metadata for the promoted v2 package.

## 1.0.0-draft.1

First draft of `@uvrn/algox`.

- Typed pipeline engine (`runPipeline`, stage contracts) generalized from the
  Expanse pipeline and x-algo's candidate-pipeline pattern.
- Reusable stages: `dropMissing`, `dedupByKey`, `capPerGroup`, `freshnessFilter`,
  `weightedScorer`, `topK`.
- `signals` preset: `rankSignals` / `buildSignalStages` with tunable `topK`,
  `capPerSource`, `maxAgeDays`, `weights`.
- Dashboard-agnostic: pure data in, ranked data out.

Not yet registered in the monorepo workspace or published to npm.
