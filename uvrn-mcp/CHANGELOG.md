# Changelog

All notable changes to @uvrn/mcp are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.2] – 2026-03-17

### Changed

- **Library vs. binary:** The package `main` entry now only exports `createServer`, `startServer`, and `logger` — it does **not** start the server on import. The runnable entry is `dist/run.js` (bin `uvrn-mcp`). Run the server via `npx uvrn-mcp` or by calling `startServer()`. README, ENVIRONMENT.md, and Claude Desktop setup docs updated to use `dist/run.js` for running the server. See root [CHANGELOG](../../CHANGELOG.md) and [default-safe behavior](../../docs/decisions/0001-default-safe-behavior.md).

## [1.5.1] – 2026-03-17

- Packed manifests no longer contain `workspace:` protocol; consumer installs work with npm/yarn.
