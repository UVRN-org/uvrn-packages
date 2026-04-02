# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-02

Initial release. Multi-source aggregation and bundle construction for UVRN consensus inputs.

### Added
- `ConsensusEngine` for source parsing, ranking, deduplication, and bundle generation
- weighted-sum source scoring across credibility, recency, and coverage
- `ConsensusStats` with LLM-friendly summary output
- `ConsensusError` for underspecified numeric evidence
