# Audit Remediation Build Log (2026-03-17)

**Context:** Implementation of the [Audit Remediation Plan](https://github.com/UVRN-org/uvrn-packages/blob/main/docs/reports/2026-03-17-monorepo-audit.md) Prioritized Recommended Actions. Plan reference: `audit_remediation_plan_27b15ae6`.

## Summary of work completed

1. **Phase 1 – SDK hash verification**  
   - `uvrn-sdk/src/validators.ts`: Replaced custom canonical payload with `hashReceipt` from `@uvrn/core`. Removed local `createCanonicalPayload` and `createHash` usage.  
   - Added core↔sdk parity tests in `uvrn-sdk/src/__tests__/validators.test.ts` (receipt from `runDeltaEngine` verifies with `verifyReceiptHash`; tampered receipt fails).

2. **Phase 2 – Dependency upgrades**  
   - `uvrn-api`: Bumped `fastify` to ^5.7.3, `@fastify/cors` to ^10.0.0, `@fastify/rate-limit` to ^10.0.0, `@fastify/helmet` to ^12.0.0; set `engines.node` to >=20.0.0.  
   - `uvrn-mcp`: Bumped `@modelcontextprotocol/sdk` to ^1.27.1.  
   - Root `package.json`: Added `pnpm.overrides` for `hono` >=4.12.7 to clear transitive advisory.  
   - `pnpm audit --prod` now reports 0 high, 0 moderate.

3. **Phase 3 – CLI/API contract drift**  
   - CLI: Added `delta-engine` bin alias in `uvrn-cli/package.json`; root and CLI READMEs use `uvrn`; `uvrn-cli/docs/CLI_GUIDE.md` updated to `uvrn` throughout.  
   - API: Added `bin: { "uvrn-api": "dist/server.js" }` in `uvrn-api/package.json`; README route examples use `/api/v1/delta/*`; programmatic example fixed to `startServer()` / `createServer()` + `listen`.  
   - SDK: README and `docs/SDK_GUIDE.md` use `uvrn` for `cliPath` and `npx @uvrn/api` for API start; `client.ts` JSDoc updated.

4. **Phase 4 – Test health**  
   - `uvrn-api/tests/smoke.test.ts`: Added; Jest runs without config error; `createServer` and `GET /api/v1/health` covered.  
   - `uvrn-mcp`: Handler tests updated to use `error.name` instead of `instanceof` where needed; mock-based tests moved to a separate describe at end to avoid leakage; `MAX_BUNDLE_SIZE` and “missing bundleId” assertions adjusted.  
   - `uvrn-cli/tests/cli.test.ts`: Version assertion reads from `package.json`.  
   - `uvrn-adapter/tests/wrapper.test.ts`: DRVC3 certificate expectation set to `DRVC3 v1.01`.

5. **Phase 5 – Adapter trust path**  
   - `uvrn-adapter/schemas/drvc3.schema.json`: Added `validation` to top-level `required`; `validation` object `required` includes `v_score`, `checks`; `checks` requires `delta_receipt`.  
   - `uvrn-adapter/src/wrapper.ts`: Before signing, calls `verifyReceipt(deltaReceipt)` from `@uvrn/core` and throws if not verified.  
   - `uvrn-adapter/src/validator.ts`: Added `verifyDRVC3Integrity(drvc3)` (schema + signature + core receipt hash); documented `validateDRVC3` as schema-only; exported `verifyDRVC3Integrity` from package.  
   - Wrapper tests now use a receipt from `runDeltaEngine` so wrap verification succeeds.

6. **Phase 6 – SDK build stability**  
   - `.gitignore`: Added `**/tsconfig.tsbuildinfo`.  
   - `uvrn-sdk/package.json`: `clean` script now removes `tsconfig.tsbuildinfo`.  
   - Removed `uvrn-sdk/tsconfig.tsbuildinfo` from git tracking (`git rm --cached`).

## Files and references

- Audit report: `docs/reports/2026-03-17-monorepo-audit.md`  
- Plan: `.cursor/plans/audit_remediation_plan_27b15ae6.plan.md` (or workspace plan copy)  
- Key code: `uvrn-sdk/src/validators.ts`, `uvrn-adapter/src/wrapper.ts`, `uvrn-adapter/src/validator.ts`, `uvrn-api/package.json`, `uvrn-mcp/package.json`, root `package.json`, `.gitignore`

## Good next steps

- Run full test suite from root: `pnpm test` (and per-package where needed).  
- Optionally add `CHANGELOG.md` entries for core, adapter, api, cli, mcp per build-discipline rule.  
- Consider tightening core validation for `sourceKind`, `originDocIds`, `maxRounds` (audit finding; not implemented in this pass).  
- Before publish: `pnpm run build` and `pnpm audit --prod` from repo root.
