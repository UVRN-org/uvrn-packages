# Changelog

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
