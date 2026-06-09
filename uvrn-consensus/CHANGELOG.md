# Changelog

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-25

### Added
- `ConsensusResult` interface: bridge type between `@uvrn/consensus` and `@uvrn/score`
- `ConsensusEngine.buildConsensusResult()`: returns `DeltaBundle` + named V-Score components in one call
- `components.completeness` = coverageScore, `components.parity` = agreementScore, `components.freshness` = recencyScore

## [1.0.0] - 2026-04-02

Initial release. Multi-source aggregation and bundle construction for UVRN consensus inputs.

### Added
- `ConsensusEngine` for source parsing, ranking, deduplication, and bundle generation
- weighted-sum source scoring across credibility, recency, and coverage
- `ConsensusStats` with LLM-friendly summary output
- `ConsensusError` for underspecified numeric evidence
