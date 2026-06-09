# UVRN Packages — Changelog

## [3.0.0] - 2026-06-09 — UVRN Packages v3 (canonical 23-package protocol generation)

**v3 is the canonical 23-package UVRN protocol generation. It supersedes all prior npm/official versions** — this repository is the source of truth, and where earlier npm version numbers appear higher, they are treated as mislabels rather than newer code.

### Release shape
- All 23 `@uvrn/*` packages aligned to a single version: **`3.0.0`**.
- Internal `@uvrn/*` peer-dependency ranges moved to **`^3.0.0`**, so v3 packages resolve only against v3 peers (no accidental mixing with v1/v2 protocol packages).
- New packages joining npm in v3: `@uvrn/algox`, `@uvrn/measure`, `@uvrn/lattice`.

### Highlights carried in this generation
- `@uvrn/measure` — pluggable relationship measurements (`agree`/`disagree`/`conflict`/`potential`) over the `@uvrn/core` `Measurement` contract.
- `@uvrn/core` — additive `Measurement` contract and `MasterReceipt` envelope.
- `@uvrn/mcp` — `delta_score_claim` host-evidence enrichment + client-neutral connector layer; output carries top-level `v_score`/`claimId` so `delta_score_claim → delta_compare` chains.
- `@uvrn/adapter` — DRVC3 envelope uses a monotonic millisecond clock (envelope metadata only; embedded `DeltaReceipt`, `integrity.hash`, signature input, schema, and verification semantics unchanged).
- `@uvrn/timeline` — query test fixtures corrected to pass an explicit date range.

### Verification
- 23/23 build and test green; all 23 pack clean (`3.0.0`, peers `^3.0.0`, no `workspace:` refs); the 3 new packages and the full peer chain install standalone from tarballs.

See each package's `CHANGELOG.md` for per-package detail, and `.admin/reports/report-release-readiness-2026-06-09.md` for the full readiness audit.
