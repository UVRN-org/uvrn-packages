# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

Initial release. Claim-level comparison helpers and divergence summaries for UVRN receipts.

### Added
- `CompareEngine.compare()` for two-claim head-to-head comparisons
- `CompareEngine.compareSeries()` for one-claim trend analysis
- mixed-shape receipt normalization and optional divergence derivation
- LLM-friendly summary output for compare and series results
