# Changelog

## [Unreleased]

### Added
- **`delta_validate_datapoint` (additive; tip surface 11 → 12).** Thin adapter over
  `@uvrn/validate`: Stage1 DataPoint shape (`structurally-ok` \| `malformed`) + optional
  explicit `runStage2` route into existing `@uvrn/measure`. Never emits `verified`. Does **not**
  overload `delta_validate_bundle`. CONNECT + plugin-manifest + connector count honesty updated.
- **uvrn-pattern-mining Wave 2 — `delta_pattern_scan` (additive; surface 12 → 13).** Thin adapter →
  `@uvrn/pattern` `scanPatterns`. Requires `joinScope` + `window`; host `history` batch or
  `RuntimeConfig.patternHistoryReader`. Detected ≠ verified; not receipt-class; measured-gap
  escalate when store batch read fails. No SPEC/receipt-4 rewrite.
- **BP-v2.1-LATER-D4 — MCP post-pipeline tools (additive; surface 9 → 11).** Thin adapters:
  `delta_read_support` → lattice `readSupport` / claim ladder; `delta_report_rank_stability` →
  algox `reportRankStability`. Documented path: `delta_score_claim` → support → rank-stability.
  Existing nine tools unchanged. CONNECT + plugin-manifest migration note. No package version bump;
  no publish; no duplicate engines.
- **`RuntimeConfig.arcanum` / `receiptStore`** — optional Layer 4 persist inject. When set,
  `delta_score_claim` persists the signed NetworkReceipt after `signReceipt` (first consumer
  repoint). Ephemeral hosts that omit both keep prior discard-at-exit behavior.
- Vitest `bp-a2-arcanum-persist.test.ts` — durable `arcanum-producer-v1` + archive restart +
  `verifyReceiptFull`.

## [4.1.0] - 2026-07-19

### Closing release
- Program closing npm release 4.1.0 — ships MCP distro + stance score-claim surface.

### Added
- Optional validated stance fields on `delta_score_claim` host sources (D1, ADR-011).
- Quorum-qualified runs use stance projections for measurements and carry `stanceMode` plus support/oppose summary inside the signed receipt payload. Omitted fields retain the legacy prominence path.
- Prominence-fallback score-claim runs also attach additive `stanceMode` on the NetworkReceipt host envelope (SPEC §3 / ADR-011); `masterReceipt` and frozen delta bytes stay untouched (D2 hard wall 4).

### Changed
- **D1 — bundle the `@uvrn/*` runtime for zero-config npx use.** The published entry now uses
  esbuild to embed workspace runtime packages while retaining them as optional peers for
  source-level type compatibility. The MCP SDK remains a normal dependency. This keeps the
  peer-hygiene rule without depending on npm's peer auto-install behavior.
- Added clean-tarball CI that installs only `@uvrn/mcp`, asserts the exact nine-tool handshake,
  proves the smoke turns red for an incorrect count, and verifies a fixture-generated signed
  NetworkReceipt against the canonical `@uvrn/receipt` implementation (ADR-006).
- Added connector-profile linting and a published-artifact purity gate. No package was published;
  release remains Admin-run at program close (D3).

## [4.0.1] - 2026-06-13

### Fixed
- **`delta_run_engine` schema: `exclusiveMinimum` corrected for JSON Schema draft 2020-12.** The `thresholdPct` field used the draft-07 boolean form (`minimum: 0.001, exclusiveMinimum: true`), which the Claude API rejects with a `400` error. Changed to the draft 2020-12 numeric form (`exclusiveMinimum: 0`), matching the documented constraint (> 0 and ≤ 1.0). All other tool schemas were unaffected.

## [4.0.0] - 2026-06-10 (unreleased)

### Added
- **`delta_score_claim` returns a signed NetworkReceipt + HumanView (additive).** New result fields alongside the unchanged `masterReceipt`/`v_score`/`claimId`/`evidenceMode`/`sourceCount`: `networkReceipt` (the `uvrn-receipt-4` envelope from `@uvrn/receipt`, wrapping the MasterReceipt payload untouched and signed with `uvrn-sig-1` Ed25519), `humanView` (`toHumanView(networkReceipt)` carrying the V-Score plus consensus completeness/parity/freshness components), and `signerPublicKey` (ephemeral signing mode only).
- **New optional `topic` input on `delta_score_claim`**, normalized via `normalizeTopic()` (`"Markets/Crypto"` → `"markets/crypto"`; unknown domains land under `custom/` — never rejected) and recorded on `networkReceipt.topic`.
- **`RuntimeConfig.signing`** — `{ privateKey, publicKeyRef } | 'ephemeral'` (default `'ephemeral'`): one fresh Ed25519 keypair per handler construction with `publicKeyRef 'uvrn-mcp-ephemeral'`; the public key is echoed in results so callers can `verifyReceiptFull()`. With explicit keys, no key material is ever emitted. Honest vocabulary: an ephemeral signature proves integrity + origin-of-this-process only, not durable identity.
- **`@uvrn/receipt` peer dependency (`^4.0.0`).** Measurement results are enriched with `humanExplanation` via `enrichMeasurements()` *before* `buildMasterReceipt`, so the human language sits inside the hashed master envelope.

### Changed
- Documented the `createServer(runtimeConfig?)` + `buildHandlers(runtimeConfig)` injection pattern as the only dependency path for tool handlers (closes the final 2026-06-04 audit major); no module-level config singletons.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

## [1.2.0] - 2026-06-05

### Added
- Added read-only canon tools for qualification checks and canon receipt reads.
- Added `delta_score_claim`, which returns a verifiable `MasterReceipt` from configured connector sources.
- Added a client-neutral plugin manifest and refreshed prompts for the nine-tool MCP surface.

## [1.1.0] - 2026-06-05

### Added
- Added stateless MCP tools for drift scoring, receipt comparison, and in-memory identity reputation lookup.
- Documented that drift and compare tools require already enriched/scored inputs; raw `DeltaReceipt` values are rejected.
- Added `RuntimeConfig` injection through `createServer(runtimeConfig?)` and `buildHandlers(cfg)`, with lazy zero-external defaults for stateful capabilities.

## [1.0.2] - 2026-03-08

### Fixed
- Type export corrections

## [1.0.0] - 2026-03-07

### Added
- MCP server for AI-native bundle processing
- Tool definitions for runDelta and validateBundle
- stdio transport support
