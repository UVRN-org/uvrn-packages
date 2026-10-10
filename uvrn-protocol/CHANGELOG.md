# @uvrn/protocol — Changelog

## [5.1.0] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.0.1 → 5.1.0): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.

## [5.0.1] - 2026-10-06

### Fixed
- Republished from the public repository `UVRN-org/uvrn-packages`: package metadata (repository URL) now points at the public repo.

### Changed
- **License:** MIT → **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name). Earlier published versions stay MIT.

## [4.1.0] - 2026-07-19

### Closing release
- Program closing npm release 4.1.0 — ships widened umbrella (normalize + algox); deps remain ^4.0.0.

- Widened the existing umbrella with `@uvrn/normalize` and `@uvrn/algox` instead of creating a
  second research umbrella. One package now covers the production research chain without leaving
  adopters to choose between overlapping umbrella packages.
- Added namespaced `normalize` and `algox` exports and exercised normalization plus ranking in the
  executed quickstart suite.
- This is dependency/export alignment only: no hash/sign implementation or canonicalizer was
  added (ADR-006, ADR-010), and the package remains publish-ready but unpublished under D3.

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

Initial release (decision D-3). Single-install convenience re-exporting the common protocol
path: core + receipt + measure + consensus + score + signal. Flat exports for the 10-line
claim → signed MasterReceipt quickstart (executed in `tests/quickstart.test.ts`); namespaced
exports for everything else. No logic of its own.
