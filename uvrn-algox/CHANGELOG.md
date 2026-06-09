# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

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
