# Changelog

## [5.1.1] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.1.0 → 5.1.1): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/core`, `@uvrn/receipt`.

## [5.1.0] - 2026-10-02

### Added
- `uvrn prob run [inputs]` — receipted probability via the optional peer `@uvrn/probability`
  (SPEC `uvrn-probability-v1`). `--key-ref` signs with the base64 Ed25519 seed from
  `UVRN_PROB_PRIVATE_KEY` (or `--key-env <name>`); the key is never taken from argv.
  `--signed-at` is opt-in so default output stays deterministic. Exit codes: 0 for any result
  including `insufficient_basis`, 1 for unbindable input, 3 for I/O / missing peer / missing key.
  `uvrn-probability-input-2` / `-3` documents exit 1 with a message that they are library-only
  (`runForecast`).
- New optional peer `@uvrn/probability` (`^0.1.0 || ^0.2.0 || ^0.3.0`). The command calls the legacy
  `runProbability` (v1) entry point only.

### Changed
- README documents `uvrn prob run` and `uvrn verify-receipt`, and states that `uvrn verify` is a hash
  recompute (integrity-checked; its `verified` output key is the legacy field name). Package
  description, keywords, `homepage`, and `bugs` updated. No command behavior changed.
- `uvrn --help` description now reads "UVRN CLI — bundle → receipt, receipt checks, receipted
  probability".

### Fixed (2026-10-06 release tests, before first publish of 5.1.0)
- `uvrn verify-receipt --key` exits 2 when the signature does not verify (wrong key, forged or missing signature); without `--key` it stays integrity-only. Scripts that relied on exit 0 in those cases will now fail, by design.

### License
- **License:** **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name).

## [5.0.0] - 2026-08-16

### Changed
- Version line 5.0.0; `@uvrn/*` peer ranges hard-cut to `^5.0.0`. (Entry backfilled at 5.1.0; see the
  root `CHANGELOG.md`.)

## [4.0.0] - 2026-06-10 (published to npm 2026-06-12)

### Changed
- Test suite deepened to meet the 60% coverage gate (A7).

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.0.2] - 2026-03-08

### Fixed
- Build output corrections

## [1.0.0] - 2026-03-07

### Added
- CLI tool: `uvrn run bundle.json` → receipt
- Commander-based argument parsing
- JSON output support
