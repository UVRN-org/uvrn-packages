# Audit — NPM Publish Readiness (`trend-engine-layer-v1`)

## Readiness Table

Legend: `PASS` / `FAIL` / `N/A`

| Package / Surface | dist generated/clean | dist gitignored/not committed | no workspace deps | files field | README complete | CHANGELOG version entry | tarball smoke/dry-run | workspace build | workspace test |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `@uvrn/core` | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/sdk` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/adapter` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/mcp` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/api` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/cli` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/drift` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/agent` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/canon` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/signal` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/farm` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/normalize` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/consensus` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/score` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/test` | PASS | PASS | FAIL | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/compare` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/identity` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/timeline` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/watch` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/embed` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/lattice` | PASS | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| `@uvrn/algox` | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | PASS | FAIL |
| `@uvrn/measure` (plan) | PASS | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS |
| `@uvrn/core` additive plans | PASS | N/A | N/A | N/A | PASS | PASS | FAIL | PASS | PASS |
| `@uvrn/mcp` phased plans | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## Prioritized Blockers

### Critical

1. **Workspace-wide tests are not green; `pnpm -r run test` currently fails in `@uvrn/timeline`.**
   - Proof: workspace run stops at `@uvrn/timeline` with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`.
   - Failure details:
     - `tests/timeline.test.ts:94-95` expects `chart.canonMarkers` length `1`, received `0`.
     - `tests/timeline.test.ts:115-116` expects summary to contain `1 canonization event`, received `Claim clm_timeline has no timeline snapshots in the requested range.`
   - Impact: Checklist item 9 fails for every current package until the workspace test gate is green.

2. **Many publishable package manifests still contain literal `workspace:*` ranges, violating the checklist and prior April report.**
   - Checklist source: `CLAUDE.md:157-165` requires `package.json` to have no `workspace:` deps.
   - Representative proofs:
     - `uvrn-sdk/package.json:35` → `"@uvrn/core": "workspace:*"`
     - `uvrn-drift/package.json:28` → `"@uvrn/score": "workspace:*"`
     - `uvrn-canon/package.json:27-28` → `"@uvrn/core": "workspace:*"`, `"@uvrn/drift": "workspace:*"`
     - `uvrn-consensus/package.json:27-30`
     - `uvrn-timeline/package.json:23-26`
     - `uvrn-watch/package.json:22-24`
   - Impact: Checklist item 3 fails for 18 current packages. These manifests are not publish-ready as written.

3. **`@uvrn/measure` build plan does not yet bake publish-readiness in by construction.**
   - Proof:
     - `.admin/build-plans/BUILD-measurement-layer.md:25-40` requires `.gitignore`, peers, optional peers, `workspace:*` devDeps, and no circular deps.
     - The plan does **not** require a `files` field containing `dist`, `README.md`, `LICENSE`.
     - The plan does **not** state that published metadata must remove `workspace:*` ranges / use semver-only manifests at publish time.
   - Impact: planned `@uvrn/measure` is not guaranteed publish-ready by its plan.

### Major

1. **Several existing READMEs are missing an explicit minimal-install note, so checklist item 5 fails.**
   - Packages failing this check from current README content:
     - `@uvrn/core` (`uvrn-core/README.md:12-18`)
     - `@uvrn/sdk` (`uvrn-sdk/README.md:20`)
     - `@uvrn/adapter` (`uvrn-adapter/README.md:12-24`)
     - `@uvrn/mcp` (`uvrn-mcp/README.md:59-65`)
     - `@uvrn/api` (`uvrn-api/README.md:12-18`)
     - `@uvrn/cli` (`uvrn-cli/README.md:14-26`)
     - `@uvrn/agent` (`uvrn-agent/README.md:29`)
     - `@uvrn/canon` (`uvrn-canon/README.md:29`)
     - `@uvrn/test` (`uvrn-test/README.md:8-11`)
     - `@uvrn/algox` (`uvrn-algox/README.md:27`)
   - Impact: those packages are missing a checklist-required README element even though install and usage examples exist.

2. **The additive `@uvrn/core` plans omit a post-change tarball smoke gate.**
   - Proof:
     - `.admin/build-plans/BUILD-core-measurement-contract.md:77-88` requires build, test, README, CHANGELOG.
     - `.admin/build-plans/BUILD-core-master-receipt.md:85-99` requires build, test, README, CHANGELOG.
     - Neither plan requires `npm pack --dry-run` or tarball smoke validation after changing the published surface.
   - Impact: publish-readiness is not fully guaranteed by construction for modified live `@uvrn/core`.

3. **Current live packages `core`, `sdk`, `adapter`, `mcp`, `api`, and `cli` do not declare `publishConfig`.**
   - Proof: no `publishConfig` block appears in:
     - `uvrn-core/package.json:1-35`
     - `uvrn-sdk/package.json:1-46`
     - `uvrn-adapter/package.json:1-41`
     - `uvrn-mcp/package.json:1-45`
     - `uvrn-api/package.json:1-49`
     - `uvrn-cli/package.json:1-42`
   - Impact: not always a registry failure, but it misses the repo’s stated metadata hygiene standard around publish/access correctness.

4. **The `@uvrn/mcp` publish checklist is centralized in Phase 5, not enforced incrementally in earlier phase docs.**
   - Proof:
     - Phase 2 updates README/CHANGELOG and semver peer deps, but no files/tarball publish gate: `.admin/build-plans/BUILD-mcp-phase2-stateless-tools.md:51-67`
     - Phase 3 same pattern: `.admin/build-plans/BUILD-mcp-phase3-canon.md:30-44`
     - Phase 4 same pattern: `.admin/build-plans/BUILD-mcp-phase4-live-scoring.md:39-56`
     - Phase 5 is where full publish checklist appears: `.admin/build-plans/BUILD-mcp-phase5-plugin-packaging.md:25-33`
   - Impact: the final phased plan set is publish-aware, but earlier phases alone are not sufficient publish gates.

### Minor

1. **`npm pack --dry-run` initially failed due a machine-specific npm cache permission issue, not a package problem.**
   - Proof: default run failed with `EPERM` under `~/.npm/_cacache/tmp/...` because of root-owned cache files.
   - Resolution during audit: rerunning with `NPM_CONFIG_CACHE=/private/tmp/uvrn-npm-cache` succeeded for all 22 packages.

2. **The prior publish-readiness report is now contradicted by current manifest reality.**
   - Proof: `.admin/reports/report-publish-readiness-2026-04-02.md:25` claims `No \`workspace:\` in deps/peers` is `✅` for the 11 wave packages.
   - Current evidence shows `workspace:*` still present in `score`, `farm`, `normalize`, `consensus`, `compare`, `identity`, `timeline`, `watch`, `test`, and others.
   - Assessment: this is either a regression since 2026-04-02 or the prior assessment did not inspect the current source manifests strictly enough.

## Comparison To Prior Report (`report-publish-readiness-2026-04-02.md`)

- **Regression / contradiction:** the April report marked all 11 wave packages clear on `No \`workspace:\` in deps/peers` (`:25`), but current source manifests still contain literal `workspace:*` ranges in most of those packages.
- **Regression:** the April report’s gate status was `CLEAR` (`:15`), but current workspace testing is no longer green because `@uvrn/timeline` fails.
- **Still resolved:** `dist/` remains untracked in git and ignored repo-wide; no current regression there.
- **Newly resolved / confirmed:** all 22 current packages pack successfully under `npm pack --dry-run` once the npm cache is redirected to a writable temp cache.

## Per-Package Verdicts

- `@uvrn/core` — NOT-READY — README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/sdk` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/adapter` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/mcp` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/api` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/cli` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/drift` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/agent` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/canon` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/signal` — NOT-READY — workspace test gate fails.
- `@uvrn/farm` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/normalize` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/consensus` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/score` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/test` — NOT-READY — manifest still contains `workspace:*`; README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/compare` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/identity` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/timeline` — NOT-READY — package tests currently fail; manifest still contains `workspace:*`.
- `@uvrn/watch` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/embed` — NOT-READY — workspace test gate fails.
- `@uvrn/lattice` — NOT-READY — manifest still contains `workspace:*`; workspace test gate fails.
- `@uvrn/algox` — NOT-READY — README lacks a minimal-install note; workspace test gate fails.
- `@uvrn/measure` (plan) — NOT-READY — plan omits explicit `files` field and semver/no-`workspace:` publish metadata requirements.
- `@uvrn/core` additive plans — NOT-READY — plans omit a tarball smoke gate after changing the published surface.
- `@uvrn/mcp` phased plans — READY — full publish checklist is explicitly enforced in Phase 5, though earlier phases alone are not sufficient publish gates.

## Cross-Cutting Notes

- Repo-wide `dist/` ignore is in place and current package `dist/` directories are untracked.
- Trend-engine worktree `.gitignore` includes `.claude/` (`.gitignore:9-16`).
- No obvious circular `@uvrn/*` dependency declarations were introduced by the trend-engine plans:
  - `@uvrn/measure` is planned as peer-only toward `consensus` / `compare` / `drift`, with an explicit “no circular deps” rule.
  - MCP Phase 4’s `@uvrn/agent` / `@uvrn/farm` link remains acyclic at the package level described by the plans.
