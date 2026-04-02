# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-01

Initial release. Provider-agnostic connector framework for UVRN data ingestion.

### Added
- `BaseConnector` with retry, timeout, API key validation, and claim coercion helpers
- Reference connectors for CoinGecko, Coinbase, Perplexity, and NewsAPI
- `MultiFarm` for parallel fan-out and partial-result aggregation
- `ConnectorRegistry` for connector discovery and composition
