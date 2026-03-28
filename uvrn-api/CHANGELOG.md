# Changelog

All notable changes to @uvrn/api are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.3] – 2026-03-28

### Changed

- Docs: MCP-first alignment (no runtime API change). Version bump for npm republish.

## [1.5.2] – 2026-03-17

### Fixed

- **Startup reliability:** `createServer()` no longer throws when `pino-pretty` is not installed. In development, pretty logging is optional; the server falls back to standard Pino output if `pino-pretty` is unavailable, so default `createServer()` always succeeds in a clean install.

### Changed

- **Logging:** Logger options are built via `buildLoggerOptions()` in `src/logger.ts`; development transport is only used when `pino-pretty` is resolvable.
- **Docs:** README now documents logging behavior by environment and the optional `pino-pretty` dependency.

## [1.5.1] – 2026-03-17

- Packed manifests no longer contain `workspace:` protocol; consumer installs work with npm/yarn.
