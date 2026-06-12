# @uvrn/protocol — Changelog

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

Initial release (decision D-3). Single-install convenience re-exporting the common protocol
path: core + receipt + measure + consensus + score + signal. Flat exports for the 10-line
claim → signed MasterReceipt quickstart (executed in `tests/quickstart.test.ts`); namespaced
exports for everything else. No logic of its own.
