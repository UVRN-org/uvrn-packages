# Changelog

All notable changes to @uvrn/mcp are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.3] – 2026-03-17

### Added
- **Run modes and lifecycle:** README now documents intended run mode (stdio with MCP client), non-interactive behavior (stdin closed → exit 0), and exit codes (0 = clean shutdown, non-zero = startup/error). Tests and automation should rely on exit codes, not log text.
- **Lifecycle test:** Integration test spawns the MCP bin with stdin closed and asserts exit code 0 (behavior-based, no log assertion).

### Changed
- **Bin behavior:** When stdin closes (no client or client disconnected), the process exits with code 0 deterministically (`process.stdin.on('close', () => process.exit(0))` in run.ts).

## [1.5.2] – 2026-03-17

### Changed

- **Library vs. binary:** The package `main` entry now only exports `createServer`, `startServer`, and `logger` — it does **not** start the server on import. The runnable entry is `dist/run.js` (bin `uvrn-mcp`). Run the server via `npx uvrn-mcp` or by calling `startServer()`. README, ENVIRONMENT.md, and Claude Desktop setup docs updated to use `dist/run.js` for running the server. See root [CHANGELOG](../../CHANGELOG.md) and [default-safe behavior](../../docs/decisions/0001-default-safe-behavior.md).

## [1.5.1] – 2026-03-17

- Packed manifests no longer contain `workspace:` protocol; consumer installs work with npm/yarn.
