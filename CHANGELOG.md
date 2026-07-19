# UVRN Packages — Changelog

> Historical references to `admin/` and `.admin/` below point to the maintainers' internal
> ops archive (plans, audits, findings), which is not part of this public repository.

## [Unreleased]

- `@uvrn/core`, `@uvrn/identity`, `@uvrn/receipt` **4.1.0** — pending npm publish (npm latest: 4.0.0).
  Shared strict canonicalization v2 (WS-CANON-UNIFY: vectors #8, strict v2 #9); legacy byte
  surface frozen — golden hashes identical under v1 and v2.
- `SPEC/uvrn-outcome-v1.md` — the outcome spine (WS-LAUNCH-001, #7).

## [4.0.1] - 2026-06-13 — @uvrn/mcp patch

- fix(mcp): `exclusiveMinimum` corrected to JSON Schema draft 2020-12; `@uvrn/mcp` → 4.0.1 (#6).

## [4.0.0] - 2026-06-12 — v4 / fable-refactor-1 generation

All 26 `@uvrn/*` packages published to npm 2026-06-12.

Refactor of the v3 LIVE generation per `admin/plans/00-MASTER-PLAN.md`. Decisions resolved 2026-06-10: version line 4.0.0 (D-1), copy-then-refactor (D-2), `@uvrn/protocol` umbrella yes (D-3), controlled starter topic taxonomy + free tags (D-4).

### Phase 7 — Final verification (2026-06-10)
- Cross-repo smoke 35/35: sign in workspace → local v4 worker ingest (SIGNATURE_VERIFIED) →
  portal module fetch + verify (exact hash recompute; wrong-key control fails).
- Subagent conformance review: all checklist lines + invariants code-verified
  (`verifyReceipt()` git-diff-empty vs pristine v3 copy).
- Fixes from review: coverage/ untracked + gitignored (F7-1), root workspaces array completed
  (F7-2), SPEC §4 response-shape amended to reality (F7-3), better-sqlite3 marked optional
  peer (F7-4).
- `admin/reports/refactor-v1-completion.md` written. Remaining gate (cleared: published 2026-06-12): @uvrn/* 4.0.0 npm publish
  → un-draft uvrn-worker#1 + uvrn-home#44 → activation (Shawn's call).

### Phase 6 — Portal dark build (2026-06-10, repo: uvrn-home)
- `feat/network-portal-v1` draft PR: src/modules/receipt/ (client, humanView, verify, 10
  presentational components incl. VerifyInline + WhyThisWins), portal routes behind
  VITE_PORTAL_V1, noindex + sitemap/prerender exclusions, D5 demo wiring (flag-gated).
  Flag-off parity proven; module isolation enforced by scripts/verify-receipt-module.mjs.
  https://github.com/UVRN-org/uvrn-home/pull/44

### Phase 5 — Worker v4 (2026-06-10, repo: uvrn-worker)
- `feat/schema-v4-topics` draft PR: migration v4 (topic/claimId/kind + 4 indexes),
  `GET /topics` `/claims/{id}` `/stats/public`, `uvrn-receipt-4` ingest with producer-signature
  flags, hash assembly via `@uvrn/receipt/canonical` (byte-equivalence proven on legacy bodies).
  19/19 local checks; production D1 untouched; merge gated on the 4.0.0 npm publish.
  https://github.com/UVRN-org/uvrn-worker/pull/1

### Phase 4 — Access layers + hygiene (2026-06-10)
- **mcp**: RuntimeConfig constructor injection completed with `signing` config (closes the
  final 2026-06-04 audit major); `topic` input; `delta_score_claim` returns a signed
  NetworkReceipt + HumanView (verifyReceiptFull green on the mock path). 59 tests.
- New **`@uvrn/protocol` 4.0.0** umbrella (26th package, D-3) — the 10-line quickstart runs as
  its test suite.
- **cli**: `verify-receipt` command (full NetworkReceipt verification, honest output).
- **Coverage (A7)**: per-package `test:coverage` gates (80% core/receipt/measure/consensus,
  60% elsewhere); canon 30→98%, cli 0→86%, api 56→82% lines.
- **Hygiene (A8)**: all 26 packages at **4.0.0**, internal ranges `^4.0.0`; 4.0.0 CHANGELOG
  entries everywhere; tarball smoke clean (no workspace: ranges, dist packed); COUPLINGS updated.

### Phase 3 — Persistence + edges (2026-06-10)
- New package **`@uvrn/store-sqlite` 4.0.0** (25th): Canon/Identity/Timeline/Watch/AgentState
  stores against one local SQLite file + `SqliteReceiptStore` outbox with `pushToNetwork()`
  (SPEC/uvrn-network-v1.md §6). Kill-and-restart acceptance green.
- **watch**: `WatchStore` seam, delivery retry w/ backoff, webhook URL validation at subscribe.
- **agent**: `AgentStateStore` seam + `restore()`; scheduler `stop()` open-handles fix;
  `--forceExit` removed.
- **farm**: `rateLimitPerMinute` enforced; circuit breaker on `BaseConnector` (5 fails / 30s
  half-open); typed `RateLimitError`/`CircuitOpenError`.
- **api**: optional Bearer/`X-UVRN-API-Key` auth (constant-time), first real test suite; CORS
  lockdown documented.
- **canon**: `StoreType` opened additively (`'sqlite' | (string & {})`).
- Workspace: 25/25 build, 490 tests green; Jest exits with no open handles.

### Phase 2 — Core + measurement hardening (2026-06-10)
- **core**: master-hash ordering rule (SPEC §2.2; shuffled input → identical hash, verified over
  stored order so old receipts stay valid); additive `MeasurementResult.humanExplanation?`;
  stale committed `src/*.js`/`*.d.ts` mirrors removed.
- **measure**: `insufficient-data` verdict for thin evidence (v3: `none`/`no-agreement`);
  `conflictRangeTolerance` (default 0 = v3); potential confidence = f(sample size, trend
  strength) with `confidenceFloor` 0.25 → weak signals report as insufficient, never overstated.
- **consensus**: `DedupConfig` (relative/absolute/off); defaults regression-tested ≡ v3.
- **identity**: Ed25519-attested `recordEvent()`; unattested events weighted 0.25 (configurable),
  keyed by public key when attested; optional accuracy half-life decay (default off).
- **lattice**: loud once-per-process mock-connector warning outside tests; `AsyncClaimClassifier`
  documented first-class.
- **receipt**: `enrichMeasurements()` + `verifyDetachedSignature()`.
- Closes 2026-06-04 audit majors 1–3 (4th, RuntimeConfig injection, lands in Phase 4 by design).
- Workspace: 24/24 build, 419 tests green.

### Phase 1 — Protocol spec + @uvrn/receipt (2026-06-10)
- New root `SPEC/`: `uvrn-receipt-v1.md` (canonicalization + the exact hash payload contract for
  every UVRN hash, incl. the additive unknown-field rule), `uvrn-signing-v1.md` (Ed25519
  `uvrn-sig-1` producer signature + existing `uvrn-seal-1` registry seal), `uvrn-measurement-v1.md`
  (decision-complete agree/disagree/conflict/potential + `insufficient-data` semantics — closes
  audit majors 1–3 of 2026-06-04), `uvrn-network-v1.md` (registry API + satellite push contract).
- New package **`@uvrn/receipt` 4.0.0** (24th package): NetworkReceipt envelope, JCS
  canonicalization (single ecosystem implementation, `./canonical` subpath), Ed25519 signing,
  topic taxonomy, Layer D vocabulary, `toHumanView()`. 47 tests green.
- Golden vectors in `SPEC/vectors/` (canonicalization, signed network receipt + must-fail
  tampering, master hash, HumanView); cross-checked with an independent Python JCS+SHA-256
  implementation.

### Phase 0 — Scaffold (2026-06-10)
- Pristine copy of v3 LIVE (23 packages @ 3.0.0) as the diffable baseline; fresh git history.
- `pnpm-workspace.yaml`: broken `allowBuilds` placeholder replaced with working build-script approval for esbuild. Note: under pnpm 11.5.2 the effective key is `allowBuilds: { esbuild: true }` — `onlyBuiltDependencies: [esbuild]` alone (the fix recorded in the trend-engine sibling) no longer suppresses `ERR_PNPM_IGNORED_BUILDS`; both are kept.
- `.admin/` carried as `admin/`; root README/CLAUDE.md/AGENTS.md headers updated to this generation.
- Baseline verified: 23/23 packages build; 364 tests green (310 jest + 54 vitest).

## [3.0.0] - 2026-06-09 — UVRN Packages v3 (canonical 23-package protocol generation)

**v3 is the canonical 23-package UVRN protocol generation. It supersedes all prior npm/official versions** — this repository is the source of truth, and where earlier npm version numbers appear higher, they are treated as mislabels rather than newer code.

### Release shape
- All 23 `@uvrn/*` packages aligned to a single version: **`3.0.0`**.
- Internal `@uvrn/*` peer-dependency ranges moved to **`^3.0.0`**, so v3 packages resolve only against v3 peers (no accidental mixing with v1/v2 protocol packages).
- New packages joining npm in v3: `@uvrn/algox`, `@uvrn/measure`, `@uvrn/lattice`.

### Highlights carried in this generation
- `@uvrn/measure` — pluggable relationship measurements (`agree`/`disagree`/`conflict`/`potential`) over the `@uvrn/core` `Measurement` contract.
- `@uvrn/core` — additive `Measurement` contract and `MasterReceipt` envelope.
- `@uvrn/mcp` — `delta_score_claim` host-evidence enrichment + client-neutral connector layer; output carries top-level `v_score`/`claimId` so `delta_score_claim → delta_compare` chains.
- `@uvrn/adapter` — DRVC3 envelope uses a monotonic millisecond clock (envelope metadata only; embedded `DeltaReceipt`, `integrity.hash`, signature input, schema, and verification semantics unchanged).
- `@uvrn/timeline` — query test fixtures corrected to pass an explicit date range.

### Verification
- 23/23 build and test green; all 23 pack clean (`3.0.0`, peers `^3.0.0`, no `workspace:` refs); the 3 new packages and the full peer chain install standalone from tarballs.

See each package's `CHANGELOG.md` for per-package detail, and `.admin/reports/report-release-readiness-2026-06-09.md` for the full readiness audit.
