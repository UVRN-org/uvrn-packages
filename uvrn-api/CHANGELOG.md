# Changelog

## [5.1.0] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.0.1 → 5.1.0): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/core`.

## [5.0.1] - 2026-10-06

### Fixed
- `uvrn-api` bin now starts: shebang added; default start no longer needs the dev-only `pino-pretty` (plain JSON logs when it isn't installed).
- `/api/v1/health` `version` and `/api/v1/version` `apiVersion` report the package version (were hard-coded "1.0.0").
- Republished from the public repository `UVRN-org/uvrn-packages`: package metadata (repository URL) now points at the public repo.

### Changed
- **License:** MIT → **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name). Earlier published versions stay MIT.

## [4.0.0] - 2026-06-10 (unreleased)

### Added
- **Optional API-key auth** for the delta routes (`/api/v1/delta/*`), same client convention as the UVRN worker: `Authorization: Bearer <key>` or `X-UVRN-API-Key: <key>`. Configured via `ServerConfig.apiKey` / `ServerConfig.apiKeys` (env: `UVRN_API_KEY` / comma-separated `UVRN_API_KEYS`). When no key is configured the API stays fully open — identical to previous behavior. `/api/v1/health` and `/api/v1/version` are always open. Key comparison is constant-time (`crypto.timingSafeEqual` on equal-length buffers). Unauthorized requests receive `401 UNAUTHORIZED`.
- Test suite covering auth (open mode, Bearer, `X-UVRN-API-Key`, wrong/missing key, key rotation list, health always open) using Fastify `inject()` — no new dependencies.
- Test suite deepened to meet the 60% coverage gate (A7): delta route, error-handler, and config-loader tests.

### Changed
- README documents CORS lockdown (`CORS_ORIGINS`, default `*`) and reverse-proxy guidance. Config shape is unchanged; new fields are optional.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.0.2] - 2026-03-08

### Fixed
- Build output corrections

## [1.0.0] - 2026-03-07

### Added
- Fastify REST API for bundle processing
- POST /v1/run endpoint
- CORS, rate limiting, helmet security
- Health check endpoint
