# Changelog

All notable changes to the UVRN monorepo (uvrn-packages) are documented in this file. Package-specific history: see [uvrn-sdk/CHANGELOG.md](uvrn-sdk/CHANGELOG.md) for the SDK.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Root [CHANGELOG.md](CHANGELOG.md) (this file) for monorepo-wide major updates.
- Alpha disclaimer added to all READMEs across the repo.

---

## [1.0.3] – 2026-03-17 (npm publish readiness)

All packages published to npm at 1.0.3 with public access under the `@uvrn` scope.

### Changed
- **All packages:** Added `publishConfig.access: "public"` for scoped public publish; version set to 1.0.3.
- **@uvrn/core, adapter, cli, api:** Added explicit `files` (dist, README) for tarball contents.
- **@uvrn/adapter, cli, api, mcp:** `@uvrn/core` dependency uses `workspace:^` so published manifest has `^1.0.3` for patch compatibility.

---

## [1.0.2] – 2026-03-17 (Audit remediation)

Major updates from the [2026-03-17 monorepo audit](docs/reports/2026-03-17-monorepo-audit.md) remediation. Full build log: [docs/reports/2026-03-17-audit-remediation-build-log.md](docs/reports/2026-03-17-audit-remediation-build-log.md).

### Fixed
- **@uvrn/sdk:** Receipt hash verification now uses core canonicalization (`hashReceipt` from `@uvrn/core`) instead of custom top-level key sort; core-generated receipts verify correctly and tampered receipts are rejected. Cross-package parity tests added.
- **@uvrn/adapter:** Wrap flow verifies receipt with `verifyReceipt` from core before signing; invalid or tampered receipts are rejected. DRVC3 schema now requires `validation` and `validation.checks.delta_receipt`.
- **@uvrn/sdk:** Build pipeline: `tsconfig.tsbuildinfo` removed from git tracking and from clean script so `clean && tsc` always emits `dist/` reliably.
- **Tests:** API smoke tests added; MCP handler tests fixed (error assertions, mock isolation); CLI version test reads from `package.json`; adapter wrapper tests use core-generated receipts.

### Added
- **@uvrn/adapter:** `verifyDRVC3Integrity(drvc3)` for full integrity check (schema + EIP-191 signature + embedded receipt hash). `validateDRVC3` documented as schema-only.
- **@uvrn/api:** `bin` entry so `npx @uvrn/api` works; smoke tests in `uvrn-api/tests/`.

### Changed
- **@uvrn/api:** Fastify upgraded to ^5.7.3 (security); @fastify/cors, rate-limit, helmet updated for Fastify 5; Node engines set to >=20.0.0.
- **@uvrn/mcp:** `@modelcontextprotocol/sdk` upgraded to ^1.27.1; root `pnpm.overrides` for `hono` >=4.12.7. Production audit: 0 high, 0 moderate advisories.
- **Docs/contracts:** CLI bin alias `delta-engine` added; all docs and SDK guides use `uvrn` and `/api/v1/delta/*`; API README programmatic example corrected.

### Security
- Fastify and Hono advisories addressed via dependency upgrades and overrides.
- Adapter no longer signs unverified receipts; first-class `verifyDRVC3Integrity` for consumers.

---

## [1.0.0] – 2026-03-08

First public npm releases under the `@uvrn` scope. See [docs/reports/2026-03-08-npm-first-publish.md](docs/reports/2026-03-08-npm-first-publish.md).

### Packages
- **@uvrn/core** – Delta Engine core (run, validate, verify, canonical hashing).
- **@uvrn/sdk** – TypeScript SDK (CLI / HTTP / local modes).
- **@uvrn/cli** – Command-line (bundle → receipt).
- **@uvrn/api** – REST API server.
- **@uvrn/mcp** – MCP server for AI assistants.
- **@uvrn/adapter** – DRVC3 envelope adapter (EIP-191 signing).

---

For per-package details and upgrade notes, see each package README and `docs/reports/`.
