# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-01

Initial release. V-Score composition helpers and scoring profiles for UVRN receipts.

### Added
- `ScoreBreakdown` for weighted component inspection and JSON serialization
- `SCORE_PROFILES` with financial, research, news, and general defaults
- `WEIGHTS` fallback export using the canonical UVRN weight values
- LLM-friendly explanation strings for score summaries
