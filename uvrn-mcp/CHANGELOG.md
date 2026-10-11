# Changelog

## [5.1.2] - 2026-10-11

Fixes found while recording real `delta_score_claim` sessions. No hashed field list, signature,
or canonicalization changed; the `SPEC/` golden vectors pass byte-identically.

### Fixed
- **Same-day reprints no longer crash `delta_score_claim`.** When fewer than two independent
  sources survive deduplication (values within 1% published within 24 hours), the tool now
  returns `insufficientIndependentSources` (the `@uvrn/consensus` shape) with
  `absoluteConsensusValue` and `stanceCounts`, instead of
  `EXECUTION_ERROR: Invalid DeltaBundle: Bundle is undefined or null`. It is an honest result:
  no receipt is built, sealed, or signed, and there is no `v_score`.
- **Stance runs without `stanceValue` refuse honestly.** When the stance quorum is met but fewer
  than two grounded sources carry a numeric `stanceValue`, the same insufficient result is returned
  with a stance-specific reason. `stanceValue` is never derived from `stanceLabel`
  (`SPEC/uvrn-stance-v1.md` §2). The `sources[].stanceValue` schema description now says so.
- **Graded one-sided stance.** When every grounded source takes the same side with graded values
  (e.g. all `supports`, 0.6–0.9), `disagree` still fires and the Tier-0 verdict stays "split" as
  `uvrn-stance-v1` §6 requires. The payload now carries the Tier-1 descriptor `same-side-graded`
  (parent `split`). The `disagree` explanation and the signed narrative say the spread is in
  strength, not side, instead of "Sources point in different directions". It never applies when
  a grounded source is mixed, neutral or on the other side, or when a value's sign disagrees with
  its label.
- **Host-source counts.** Host mode records one node per source (duplicate URLs get a `#n`
  suffix), so the signed narrative and `humanView` read "4 of 4 sources weighed in", not "1 of 1".
  Connector and mock modes still record one node per connector.
- **Stance-axis score basis.** On stance runs where no source carries a numeric `value` /
  `evidenceScore`, the V-Score components were not measured. The result now adds
  `scoreBasis: { measured: false, reason }` and `humanView.scoreCard` omits the numbers;
  `v_score` stays 0 for type compatibility.

### Breaking
- **`delta_verify_receipt` no longer returns `verified`.** It was an alias for `integrityOk`, but
  no signature is checked, so it broke the rule that "verified" means integrity plus signature.
  This removes a documented field in a patch release, a deliberate choice of the honesty rule
  over semver. Callers reading `result.verified` now get `undefined`.
  - **Migrate:** read `integrityOk`. It means integrity-checked only. A legacy DeltaReceipt carries
    no signature, so it cannot be verified.
  - **For verification:** use the signed `networkReceipt` from `delta_score_claim` with
    `verifyReceiptFull(networkReceipt, { publicKey })` from `@uvrn/receipt` (installed separately),
    or `npx @uvrn/cli verify-receipt`.
  - The tool description, the `details` text and the analysis prompt no longer suggest
    `verifyReceiptFull()` for legacy receipts.
- **`delta_score_claim` can now succeed without a receipt.** Runs with fewer than 2 independent
  sources used to return an `EXECUTION_ERROR`. They now return a successful result carrying
  `insufficientIndependentSources`, with no `masterReceipt`, `networkReceipt`, `humanView` or
  `v_score`.
  - **Migrate:** check `insufficientIndependentSources` before reading the receipt fields.
  - The tool description now says so.

### Changed
- `@modelcontextprotocol/sdk` range tightened from `^1.0.0` to `^1.27.1` (the tested version).

### Known
- On the stance axis, value-similarity dedup still treats independent sources with identical
  `stanceValue`s published the same day as reprints (four outlets at 0.9 → one source). The
  result is now an honest insufficient result with that reason, not a crash; whether stance values
  should be deduplicated at all is a `@uvrn/consensus` / `uvrn-stance-v1` decision.

## [5.1.1] - 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.1.0 → 5.1.1): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.

## [5.1.0] - 2026-10-02

### Added
- **`delta_prob_run` (additive; surface 13 → 14).** Thin adapter → optional peer
  `@uvrn/probability` `runProbability` (SPEC `uvrn-probability-v1`). Cited market / base-rate
  inputs only; `insufficient_basis` refusals are successful results; unbindable input
  (`outcomeHash` / `asOf.at`) is a `VALIDATION_ERROR`. Receipts are signed with the server's
  resolved signer (`signerPublicKey` emitted in ephemeral mode only). Probability, never a V-Score.
  Manifest, CONNECT, Odysseus, connector validator, and protocol test counts updated.
- New optional peer `@uvrn/probability` (`^0.1.0 || ^0.2.0 || ^0.3.0`).

### Changed
- MCP handshake `serverInfo.version` and `plugin-manifest.json` `version` now report the package
  version (`5.1.0`); they previously carried stale `1.2.0` / `4.0.1` values.
- The tarball no longer ships test fixtures (`dist/__tests__/fixtures`); `src/__tests__` is excluded
  from the declaration build.
- README documents `delta_prob_run`; package description, keywords, `homepage`, and `bugs` updated.

### Fixed (2026-10-06 release tests, before first publish of 5.1.0)
- `@uvrn/probability` is now truly an optional peer: it is loaded from the host, `delta_prob_run` returns a clean install hint when it is missing, and every other tool keeps working. The other `@uvrn/*` packages stay bundled and are no longer listed as peers.
- Types ship as one self-contained `dist/index.d.ts`; `createServer` is declared to return `McpServerHandle` (`connect`, `close`); at runtime it is still the SDK `Server`.

### License
- **License:** **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name).

## [5.0.0] - 2026-08-16

The entries below were listed under Unreleased until 5.1.0; they are present in the published
`5.0.0` and `5.0.1` tarballs.

### Added
- **`delta_validate_datapoint` (additive; surface 11 → 12).** Thin adapter over
  `@uvrn/validate`: Stage1 DataPoint shape (`structurally-ok` \| `malformed`) + optional
  explicit `runStage2` route into existing `@uvrn/measure`. Never emits `verified`. Does **not**
  overload `delta_validate_bundle`. CONNECT + plugin-manifest + connector count honesty updated.
- **uvrn-pattern-mining Wave 2 — `delta_pattern_scan` (additive; surface 12 → 13).** Thin adapter →
  `@uvrn/pattern` `scanPatterns`. Requires `joinScope` + `window`; host `history` batch or
  `RuntimeConfig.patternHistoryReader`. Detected ≠ verified; not receipt-class; measured-gap
  escalate when store batch read fails. No SPEC/receipt-4 rewrite.
- **MCP post-pipeline tools (additive; surface 9 → 11).** Thin adapters:
  `delta_read_support` → lattice `readSupport` / claim ladder; `delta_report_rank_stability` →
  algox `reportRankStability`. Documented path: `delta_score_claim` → support → rank-stability.
  Existing nine tools unchanged. CONNECT + plugin-manifest migration note. No duplicate engines.
- **`RuntimeConfig.arcanum` / `receiptStore`** — optional Layer 4 persist inject. When set,
  `delta_score_claim` persists the signed NetworkReceipt after `signReceipt` (first consumer
  repoint). Ephemeral hosts that omit both keep prior discard-at-exit behavior.
- Test: durable archive persist across restart, checked with `verifyReceiptFull`.

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
- Added connector-profile linting and a published-artifact purity gate.

## [4.0.1] - 2026-06-13

### Fixed
- **`delta_run_engine` schema: `exclusiveMinimum` corrected for JSON Schema draft 2020-12.** The `thresholdPct` field used the draft-07 boolean form (`minimum: 0.001, exclusiveMinimum: true`), which the Claude API rejects with a `400` error. Changed to the draft 2020-12 numeric form (`exclusiveMinimum: 0`), matching the documented constraint (> 0 and ≤ 1.0). All other tool schemas were unaffected.

## [4.0.0] - 2026-06-10 (published to npm 2026-06-12)

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
