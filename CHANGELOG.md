# Changelog

All notable changes to the UVRN monorepo (uvrn-packages) are documented in this file. Package-specific history: see [uvrn-sdk/CHANGELOG.md](uvrn-sdk/CHANGELOG.md) for the SDK.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **CI:** Pack-check workflow step renamed to "Contract test (clean install from tarballs + smoke)"; comment added that the smoke runs in an isolated temp dir with only packed tarballs.
- **Docs:** Added [docs/decisions/0001-default-safe-behavior.md](docs/decisions/0001-default-safe-behavior.md) (ADR) for default-safe behavior: no required optional deps, no side effects on import, single source of truth for version.

---

## [1.5.3] – 2026-03-17

Stabilization pass (post-publish validation): MCP lifecycle contract, SDK replay implementation, smoke and CI hardening.

### Added
- **CI:** Test step in pack-check workflow; failures in unit/integration tests (including SDK replay, MCP lifecycle) now block the run before pack and smoke.
- **Smoke:** Behavior-based checks: SDK `replayReceipt(receipt, bundle, executeFn)` smoke (success + deterministic); MCP bin lifecycle (run with stdin closed, assert exit 0). No log-text assertions. Stale tarballs removed before pack so consumer install uses fresh builds.

### Changed
- **@uvrn/sdk 1.5.3:** `replayReceipt(receipt, bundle, executeFn)` fully implemented; validation and determinism checks; typed error codes. Breaking: signature now requires `bundle`. See [uvrn-sdk/CHANGELOG.md](uvrn-sdk/CHANGELOG.md).
- **@uvrn/mcp 1.5.3:** Run modes, lifecycle, and exit codes documented in README; bin exits 0 when stdin closes; integration test for lifecycle (exit code only). See [uvrn-mcp/CHANGELOG.md](uvrn-mcp/CHANGELOG.md).

---

## [1.5.2] – 2026-03-17

### Fixed

- **@uvrn/api:** `createServer()` no longer throws when `pino-pretty` is missing. Development pretty logging is optional; the server falls back to standard Pino output so default `createServer()` succeeds in a clean install. See [uvrn-api/CHANGELOG.md](uvrn-api/CHANGELOG.md).

### Changed

- **@uvrn/sdk:** `VERSION` is now read from `package.json` at runtime so it stays in sync with the published version (no more hardcoded 1.0.0). See [uvrn-sdk/CHANGELOG.md](uvrn-sdk/CHANGELOG.md).
- **@uvrn/mcp:** Library entry (`main`) no longer starts the server on import. Bin entry is `dist/run.js`; importing the package only exports `createServer` and `startServer`. Run the server via `npx uvrn-mcp` or by calling `startServer()`. See [uvrn-mcp/CHANGELOG.md](uvrn-mcp/CHANGELOG.md).

---

## [1.5.1] – 2026-03-17

Publish fix: packed manifests no longer contain `workspace:` protocol; consumer installs work with npm/yarn.

### Fixed
- **Published packages:** No longer contain `workspace:` protocol in `dependencies`, `peerDependencies`, or `optionalDependencies`. Consumers can install with npm/yarn without `EUNSUPPORTEDPROTOCOL Unsupported URL Type "workspace:"`. Prepack/postpack scripts rewrite `@uvrn/core` to a semver range (e.g. `^1.5.1`) in packed manifests while keeping `workspace:^` in source for monorepo dev.

### Changed
- **All packages:** Version bumped to 1.5.1; READMEs and package CHANGELOGs updated. Added `scripts/rewrite-workspace-deps.js`, `scripts/restore-workspace-deps.js`, `scripts/check-packed-manifests.js`, `scripts/smoke-test-consumer.js`; CI workflow `.github/workflows/pack-check.yml`; root script `smoke:consumer` for install-from-tarball verification.

---

## [1.5.0] – 2026-03-17 (stabilization pass included)

Workspace lint alignment, code quality hardening, and CI stabilization. All packages versioned at 1.5.0.

### Fixed
- **Lint alignment:** ESLint was non-functional across all 6 packages. Added shared root `.eslintrc.js` with consistent rules; all packages now extend it.
- **@uvrn/sdk, @uvrn/cli, @uvrn/api:** Missing `.eslintrc` config files created.
- **@uvrn/core, @uvrn/mcp:** `.d.ts` and test files excluded from lint glob via `ignorePatterns` — eliminates "TSConfig does not include this file" parser errors.
- **@uvrn/adapter:** Added missing `eslint`, `@typescript-eslint/eslint-plugin`, and `@typescript-eslint/parser` devDependencies; created `.eslintrc.js`.
- **@uvrn/core:** `canonicalSerialize(obj: any)` → `canonicalSerialize(obj: unknown)` with proper narrowing.
- **@uvrn/mcp:** Converted `.eslintrc.json` to `.eslintrc.js` for `__dirname` support in `tsconfigRootDir`.
- **Root parser resolution:** Added `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, and `eslint` to root `devDependencies` so the shared root `.eslintrc.js` can always resolve its declared parser/plugin regardless of pnpm hoisting behavior.
- **esbuild version split:** Added `"esbuild": ">=0.25.0"` to root `pnpm.overrides`, collapsing the dual `0.21.5`/`0.27.x` split in the lockfile. Eliminates "Host version does not match binary version" errors in `@uvrn/mcp` tests on affected pnpm store states.
- **@uvrn/mcp:** Test script changed from `vitest` (watch mode, hangs) to `vitest run` — clean exit in CI and from root `pnpm run test`. `test:watch` added for local dev.
- **@uvrn/cli:** `fetchUrl` response typed properly (`string | Buffer` chunk); `writeOutput(data: any)` → `writeOutput(data: unknown)`; `no-console` set to `off` in CLI eslintrc (console output is intentional for a CLI entrypoint).
- **Root scripts:** `test` and `lint` switched from `npm --workspaces` to `pnpm -r run`; root `test` prefixed with `CI=1` so `vitest run` and jest both exit cleanly without a TTY.
- **@uvrn/sdk build:** `npm run clean && tsc` → `rm -rf dist dist-esm tsconfig.tsbuildinfo && tsc` — removes npm subprocess and associated env warning noise.
- **Lint glob normalization:** All packages changed from `eslint src/**/*.ts` to `eslint src --ext .ts` — directory-walk form respects `ignorePatterns` before file enumeration, eliminating "File ignored" warning noise.
- **Lockfile:** Regenerated to reflect all manifest changes, including adapter eslint deps and esbuild override.

### Changed
- **All packages:** Version bumped to 1.5.0; READMEs updated.

---

## [1.5.0-original] – 2026-03-17

Workspace lint alignment and code quality hardening. All packages versioned at 1.5.0.

### Fixed
- **Lint alignment:** ESLint was non-functional across all 6 packages. Added shared root `.eslintrc.js` with consistent rules; all packages now extend it. All packages lint cleanly (0 errors).
- **@uvrn/sdk, @uvrn/cli, @uvrn/api:** Missing `.eslintrc` config files created (previously `eslint` errored with "couldn't find a configuration file").
- **@uvrn/core, @uvrn/mcp:** `.d.ts` and test files no longer cause "TSConfig does not include this file" errors — added to `ignorePatterns`.
- **@uvrn/adapter:** Added missing `eslint`, `@typescript-eslint/eslint-plugin`, and `@typescript-eslint/parser` devDependencies; created `.eslintrc.js`.
- **@uvrn/core:** `canonicalSerialize(obj: any)` changed to `canonicalSerialize(obj: unknown)` with proper narrowing — resolves `@typescript-eslint/no-explicit-any` error.
- **@uvrn/mcp:** Converted `.eslintrc.json` to `.eslintrc.js` to support `__dirname` in `tsconfigRootDir`.

### Changed
- **All packages:** Version bumped to 1.5.0; READMEs updated.

---

## [1.4.0] – 2026-03-17

All packages versioned at 1.4.0. Adapter breaking API change: sign with private key hex instead of ethers Wallet.

### Changed
- **@uvrn/adapter:** Replaced `ethers` with `@noble/hashes` and `@noble/secp256k1` for EIP-191 signing; dependency footprint reduced from ~1MB+ to ~40KB.
- **All packages:** Version set to 1.4.0; READMEs and docs updated.

### Breaking
- **@uvrn/adapter:** `wrapInDRVC3` and `signHash` now take a private key hex string instead of an ethers Wallet. See [uvrn-adapter/CHANGELOG.md](uvrn-adapter/CHANGELOG.md).

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
