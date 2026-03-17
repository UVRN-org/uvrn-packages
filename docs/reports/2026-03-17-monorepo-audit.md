# UVRN Monorepo Audit Report

Supersedes `cl_2026-03-17-monorepo-audit.md`.

Date: 2026-03-17
Workspace: `/Users/stsdev1/Documents/SuttleMedia/SuttleMediaLLC/UVRN/uvrn-packages`
Scope: `uvrn-core`, `uvrn-sdk`, `uvrn-cli`, `uvrn-api`, `uvrn-mcp`, `uvrn-adapter` (all workspace packages found in `pnpm-workspace.yaml`)

Method summary:
- Audit method: agent-driven static and tooling review (docs, source, tests, `pnpm build`/`test`/`audit`/`outdated`).
- Reviewed root and package docs (`README.md`, package READMEs, `uvrn-cli/docs/CLI_GUIDE.md`, `uvrn-sdk/docs/SDK_GUIDE.md`, `uvrn-api/TESTING_GUIDE.md`, `docs/`).
- Reviewed implementation and tests across all packages.
- Ran build/tests and security tooling:
  - `pnpm run build` (passes)
  - `pnpm test` (fails in multiple packages)
  - `pnpm --filter @uvrn/cli exec jest --runInBand` (1 fail)
  - `pnpm --filter @uvrn/mcp exec vitest run` (6 fails)
  - `pnpm --filter @uvrn/adapter exec jest --runInBand` (2 fails)
  - `pnpm --filter @uvrn/api exec jest` (config error: missing tests dir)
  - `pnpm audit --prod --json` (1 high, 1 moderate, 1 low advisory)
  - `pnpm outdated -r --format json` (multiple outdated dependencies)

---

## 1) Security

| Finding | Severity / Impact | Location | Recommended fix |
|---|---|---|---|
| Fastify content-type validation bypass (CVE-2026-25223 / GHSA-jx2c-rxcm-jvmq) in API dependency tree | High: malformed `Content-Type` handling can bypass validation in vulnerable Fastify versions | Dependency path from audit: `uvrn-api>fastify` (resolved `4.29.1`), manifest at `uvrn-api/package.json:25` | Upgrade Fastify to a patched version (>=5.7.2 per advisory) and re-run audit/tests. |
| Fastify Web Streams DoS advisory (CVE-2026-25224 / GHSA-mrq3-vjjr-p77c) | Low: memory pressure risk in affected stream handling paths | Dependency path from audit: `uvrn-api>fastify` | Upgrade Fastify to patched version (>=5.7.3 per advisory); avoid Web Streams responses until upgraded. |
| Hono prototype-pollution advisory (GHSA-v8w9-8mx6-g223) via MCP SDK | Moderate: transitive parser vulnerability exposure | Dependency path from audit: `uvrn-mcp>@modelcontextprotocol/sdk>hono` | Upgrade `@modelcontextprotocol/sdk` to a version that pulls patched `hono` (>=4.12.7). |
| SDK receipt verification uses non-core canonicalization | Critical: valid receipts produced by core are rejected by SDK verification | `uvrn-sdk/src/validators.ts:193-213` vs core canonicalization in `uvrn-core/src/core/serialization.ts:14-41` | Reuse core canonicalization (`canonicalSerialize` / `hashReceipt`) in SDK instead of custom `JSON.stringify(..., Object.keys(...).sort())`. |
| DRVC3 validation is schema-only; no cryptographic verification | High: `validateDRVC3` can return valid for envelopes with untrusted/forged signatures | `uvrn-adapter/src/validator.ts:31-53`; signature verification is separate in `uvrn-adapter/src/signer.ts` | Add `verifyDRVC3Integrity` that checks core hash replay and `verifySignature`, and document `validateDRVC3` as schema-only until then. |
| DRVC3 schema allows missing `validation` block that extractor assumes exists | Medium: structurally “valid” envelope can still crash/behave unexpectedly when extracting | Schema required fields omit `validation` at `uvrn-adapter/schemas/drvc3.schema.json:7-15`; extractor dereferences `validation.checks.delta_receipt` at `uvrn-adapter/src/wrapper.ts:101-102` | Require `validation` and nested `checks.delta_receipt` in schema, or hard-validate before extraction. |
| Adapter signs any supplied `deltaReceipt.hash` without verifying payload integrity first | Medium: adapter may attest an already-tampered receipt payload | `uvrn-adapter/src/wrapper.ts:46-51` | Verify receipt with core (`verifyReceipt`) before signing; reject mismatches. |
| API default CORS config is wildcard with credentials enabled | Medium: weak default cross-origin posture | `uvrn-api/src/config/loader.ts:15` and `uvrn-api/src/server.ts:42-45` | Default to explicit origins for non-dev, and disallow `*` when `credentials: true`. |
| Core validation leaves untrusted fields under-validated (`sourceKind`, `originDocIds`, `maxRounds`) | Medium: malformed bundles can pass validation and produce surprising runtime behavior | `uvrn-core/src/core/validation.ts:33-56` | Add strict validation for `sourceKind` enum, `originDocIds` array shape, and positive-integer `maxRounds`. |
| MCP env validation contract does not match implementation | Low: operators can set invalid values without startup failure despite docs claiming strict validation | Docs claim strict validation at `uvrn-mcp/ENVIRONMENT.md:211-224`; implementation only validates `LOG_LEVEL` at `uvrn-mcp/src/config.ts:11-24` | Enforce numeric/boolean validation for `MAX_BUNDLE_SIZE` and `VERBOSE_ERRORS`, or update docs to current behavior. |

---

## 2) Alignment (Docs/Contracts vs Code)

| Finding | Severity / Impact | Location | Recommended fix |
|---|---|---|---|
| CLI binary name mismatch (`uvrn` vs documented `delta-engine`) | High: documented commands fail for fresh installs | Bin: `uvrn-cli/package.json:7`; CLI name/docs: `uvrn-cli/src/cli.ts:253`, `uvrn-cli/README.md:13-17`, root `README.md:8` | Publish both bin aliases (`uvrn` and `delta-engine`) or align all docs and SDK examples to one canonical bin. |
| API docs advertise `npx @uvrn/api`, but package has no `bin` entry | High: install/run instructions can fail for users | Docs: `README.md:9`, `uvrn-api/README.md:21-23`; package: `uvrn-api/package.json` (no `bin`) | Add `bin` for API CLI entrypoint or change docs to `node dist/server.js` / `npm run start` usage. |
| API README route paths omit `/api/v1` prefix | Medium: copy-paste examples return 404 | Docs: `uvrn-api/README.md:34-42`; routes: `uvrn-api/src/routes/delta.ts` | Update README examples to `/api/v1/delta/*`. |
| API README programmatic start example passes wrong type to `startServer` | Medium: example code is incorrect | Example: `uvrn-api/README.md:27-32`; signature: `uvrn-api/src/server.ts:111` | Correct example to either `await startServer()` or `const s = await createServer(); await s.listen(...)`. |
| SDK docs reference non-existent CLI/API commands | Medium: CLI mode and HTTP mode setup instructions are wrong | SDK README `cliPath` uses `delta-engine` at `uvrn-sdk/README.md:110`; SDK guide uses `uvrn-api start` at `uvrn-sdk/docs/SDK_GUIDE.md:93-95` | Sync SDK docs with actual published bin names/entrypoints. |
| Version constants/metadata drift from package versions | Medium: health/version endpoints and constants report stale version data | `uvrn-sdk/src/index.ts:61` (`1.0.0`), `uvrn-api/src/routes/health.ts:10`, `uvrn-mcp/src/server.ts:36` vs package versions `1.0.2` in each `package.json` | Source version strings from package metadata at build/runtime (single source of truth). |
| DRVC3 version string inconsistent across code/docs/tests | Medium: contract ambiguity; failing tests | Wrapper default `DRVC3 v1.01` at `uvrn-adapter/src/wrapper.ts:72`; type doc says v1.0 at `uvrn-adapter/src/types.ts:82`; test expects v1.0 at `uvrn-adapter/tests/wrapper.test.ts:50` | Standardize to one version string and update schema/docs/tests together. |
| MCP README examples use `sha256:`-prefixed hash, core returns raw hex | Low: misleading examples for integrators | Example output `uvrn-mcp/README.md:166,227,237`; core hash format is hex (`uvrn-core/src/core/serialization.ts:40`) | Update examples to raw hex hash format or explicitly document any prefixing layer. |
| Cross-package receipt field contract mismatch (`suggestedFixes`) | Medium: schemas/validators accept receipts that fail core verification semantics | Core requires `suggestedFixes` field (`uvrn-core/src/types/index.ts:44`); MCP schema does not require it (`uvrn-mcp/src/tools/schemas.ts:104`); SDK validator also does not enforce it (`uvrn-sdk/src/validators.ts:143-176`) | Align schemas and validators with core receipt contract (or intentionally relax core contract and version it). |
| API testing guide references non-existent helper script and stale versions | Low: test docs are not executable as written | `uvrn-api/TESTING_GUIDE.md:27` (`./test-api.sh` not present), expected `1.0.0` versions at `:49`, `:75-77` | Update guide to current scripts/endpoints/versions or add missing script. |

---

## 3) Intentional Functionality (Behavioral Audit)

| Finding | Severity / Impact | Location | Recommended fix |
|---|---|---|---|
| SDK `verifyReceiptHash` produces false negatives for core receipts | Critical: exported verification API is functionally incorrect | `uvrn-sdk/src/validators.ts:193-213`; reproduced with core-generated receipts | Replace SDK hash logic with core’s canonical hash implementation and add positive/negative cross-package tests. |
| SDK `replayReceipt` is exported but intentionally unimplemented | Medium: API surface suggests determinism replay exists, but always returns failure | `uvrn-sdk/src/validators.ts:232-257` | Mark experimental/deprecated or implement with bundle replay support and tests. |
| SDK build can produce zero artifacts (`dist/` missing) because incremental cache is tracked and not cleaned | High: package can publish/bundle without compiled outputs if `tsconfig.tsbuildinfo` says “up-to-date” | Build script `uvrn-sdk/package.json:22-24`; tracked cache file `uvrn-sdk/tsconfig.tsbuildinfo` | Remove tracked tsbuildinfo, clean it in `clean` script, or disable incremental for publish builds. |
| SDK package exports only `require`, while docs provide ESM import examples | Medium: ESM consumers may fail depending on resolver | `uvrn-sdk/package.json:7-12` vs ESM examples `uvrn-sdk/README.md:61-91` | Add `import`/`default` export conditions or update docs to CJS-only consumption until ESM is supported. |
| CLI documentation claims “No External Calls,” but CLI fetches remote URLs | Low: behavior contradicts stated non-I/O guarantee | Claim in `uvrn-cli/docs/CLI_GUIDE.md:31-33`; URL fetch in `uvrn-cli/src/cli.ts:76-97` | Clarify that engine logic is pure but CLI wrapper supports optional network input, or remove URL mode. |
| CLI run exit-code semantics differ from guide wording | Low: automation may assume non-consensus is non-zero | Guide says run code `0` means “consensus achieved” at `uvrn-cli/docs/CLI_GUIDE.md:140-144`; implementation exits 0 for any successful run at `uvrn-cli/src/cli.ts:150` | Document true behavior (0 = command succeeded regardless of outcome) or change exit policy and major-version it. |
| MCP exposes resources that are intentionally unimplemented | Medium: capability discovery advertises resources that always error | Listed in `uvrn-mcp/src/server.ts:185-194`; handlers throw placeholder errors at `uvrn-mcp/src/resources/handlers.ts:30-47` | Hide placeholder resources from capability list until storage layer exists, or mark as `experimental` in structured metadata. |
| Adapter `receipt_id` uniqueness relies on `Date.now()`; same-ms calls can collide | Low: duplicate IDs under high-throughput wrapping | `uvrn-adapter/src/wrapper.ts:44`; integration test currently fails on this assumption at `uvrn-adapter/tests/integration.test.ts:116` | Use random/UUID suffix instead of millisecond timestamp alone. |
| Adapter extraction has no guardrails before returning embedded receipt | Medium: callers may trust unverified envelope contents | `uvrn-adapter/src/wrapper.ts:101-102` | Provide safe extractor that validates schema + signature + embedded core hash before returning data. |

---

## 4) Purpose Completion (Per Package)

| Package | Stated purpose (docs) | Completion assessment | Gaps blocking full completion |
|---|---|---|---|
| `@uvrn/core` | Deterministic engine (`run`, `validate`, `verify`) and canonical SHA-256 receipts | Mostly complete | Validation contract is incomplete for `sourceKind`, `originDocIds`, `maxRounds` (`uvrn-core/src/core/validation.ts`); no explicit tests for these constraints. |
| `@uvrn/sdk` | Programmatic client across CLI/HTTP/local modes + validation/verification utilities | Partial | Hash verification is incorrect; replay API is stubbed; build pipeline can skip emit; docs/examples not aligned with package exports/bin names. |
| `@uvrn/cli` | Bundle→receipt CLI with validate/verify | Partial | User-facing bin name mismatch (`uvrn` vs `delta-engine`), doc drift, and failing version test (`uvrn-cli/tests/cli.test.ts:15`). |
| `@uvrn/api` | REST server exposing run/validate/verify endpoints | Partial | Endpoint code exists and works, but docs/start instructions are wrong and automated tests are effectively absent (`uvrn-api/jest.config.js:4` points to missing tests dir). |
| `@uvrn/mcp` | MCP tools/resources/prompts for AI clients | Partial | Core tools work, but resources are placeholder-only, version metadata is stale, and test suite has persistent failures (`uvrn-mcp/src/__tests__/tools/handlers.test.ts`). |
| `@uvrn/adapter` | DRVC3 envelope wrapper/signing for core receipts | Partial | Envelope cryptographic trust model is incomplete (schema-only validation, no integrated signature verification), and contract/tests are inconsistent on DRVC3 version/defaults. |

### Test and quality coverage gaps affecting purpose completion

- `@uvrn/api`: no runnable test suite despite test script; current Jest config errors before execution (`uvrn-api/jest.config.js:4`).
- `@uvrn/sdk`: no dedicated `DeltaEngineClient` integration tests across `cli/http/local` modes.
- Cross-package boundary tests are missing for:
  - core↔sdk receipt hash/serialization parity,
  - core↔mcp receipt schema parity,
  - core↔adapter safe extract/verify flow.

### Prior report / decisions status

- Prior report found: `docs/reports/2026-03-08-npm-first-publish.md`.
- Open items in that report still relevant:
  - Add `CHANGELOG.md` beyond SDK (still missing for core/adapter/mcp/api/cli).
  - External integration follow-up (“uvrn-ledger adapter deps”) is not addressed in this repo and remains open/outside this codebase.
- No `docs/decisions/` (ADR) directory is present in this workspace.

---

## Brief Summary

The monorepo has strong foundational implementation in `@uvrn/core`, but cross-package contract drift is now the main risk. The largest immediate issues are: (1) incorrect SDK receipt verification logic, (2) known vulnerable dependencies (notably Fastify in API), and (3) packaging/doc alignment issues that break consumer onboarding (`delta-engine` vs `uvrn`, API run instructions, stale version metadata). Several packages are functionally partial rather than complete due missing or failing test paths.

## Prioritized Recommended Actions

1. Fix `@uvrn/sdk` hash verification to use core canonicalization, then add cross-package parity tests.
2. Upgrade vulnerable dependencies (`fastify`, MCP SDK/hono chain), then re-run `pnpm audit --prod --json` until high/moderate issues are cleared.
3. Resolve CLI/API execution contract drift: bin names, API `bin` entry (or docs), route path docs, and SDK setup examples.
4. Repair test health across packages (`uvrn-api` missing tests config, `uvrn-mcp` failing handlers tests, adapter/CLI stale version expectations).
5. Harden adapter trust path: require `validation` in schema, verify signatures/hashes in a first-class API, and verify receipt integrity before signing.
6. Stabilize SDK build pipeline by removing tracked incremental cache from source control and cleaning `tsconfig.tsbuildinfo` during build clean.
