# Findings — Lattice Search Delegate + Claim Sufficiency (2026-06-02)

Bloom **Reflect** notes from the v0.3.0 (searchDelegate) and v0.4.0 (claim sufficiency) builds.

## Observations

1. **`searchDelegate` was already exportable.** `SearchDelegate` / `SearchResult` are public via
   `export * from './connectors'`, so no `src/index.ts` change was needed for Build 2. The
   original build plan's open question about re-exporting is resolved: nothing to do.

2. **The integrated sufficiency hook needs explicit provenance.** Lattice `DomainSignal.source`
   values are URIs (`mock://…`, `delegate://…`, result URLs), not provenance vocabulary. The
   `DefaultEvidenceTagger` returns `null` for them, so a bridge-only `runLattice` claim run is
   always `Unverified`. This is a *type* mismatch (lattice emits consensus metrics; sufficiency
   wants provenance-class evidence), not a matcher bug. Resolved by merging an explicit
   `LatticeOptions.evidence` provenance list with the bridged signals, and documenting the limit.
   Tests assert field *presence* (not `Supported`) for the bridge-only path.

3. **Naming discipline paid off.** Kept the verdict score as `evidenceCoverageScore` and avoided
   the word "confidence" (which already loosely means the V-Score across drift/score). Public
   docs say "Claim ↔ Evidence Sufficiency", reserving "Layer 1" for internal vision cross-refs.

4. **Rule-based classifier is honestly limited.** Keyword cohorts handle clear-verb claims
   (L1–L5) but fall back to L2 for domain-general claims like "inflation is rising" (no ladder
   verb). Documented as expected; the `AsyncClaimClassifier` interface is the upgrade path. The
   domain-generality of the *evidence taxonomy* (CPI/temperature → market_expansion) is intact
   and tested independently of the classifier.

5. **Bridged value dropped on purpose.** A DomainSignal's 0–100 `value` is a consensus metric,
   not an evidence-strength signal; feeding it into coverage scoring would skew verdicts by
   V-Score magnitude. Bridged items fall back to the matcher's neutral strength.

## Audit response (2026-06-02)

External audit returned **no critical findings; approve with minor follow-ups**. Actions taken:

- **M1 (hash stability) — resolved.** Proved a claim-less receipt hashes byte-identically on the
  v0.2.0 baseline and this branch using a deterministic fixed-ts connector
  (`083e38f9e7699a9a64c9d1525db4c4c3a3ea01f77ff9603fa18af6732decffcc`). Committed as a golden
  regression test in `tests/latticeSufficiency.test.ts`.
- **Discovery while proving M1:** `MockDomainConnector` (and `ClaudeSearchConnector`) stamp each
  signal with `new Date().toISOString()`, so receipts built from those connectors have
  **non-deterministic hashes run-to-run** — the `timestamp` option controls only the receipt/delta
  ts, not per-signal ts. This is pre-existing and in locked/pre-release files, out of scope here;
  flagged separately for evaluation (reproducibility of receipts is arguably a protocol concern).
  The golden test therefore uses a deterministic connector, not Mock.
  **Update — resolved in v0.4.1:** `DomainConnector.fetch` now takes an optional
  `ConnectorContext { timestamp }`; `runLattice` threads its single run timestamp to every
  connector, and the bundled connectors use it instead of the wall clock. Same query +
  `options.timestamp` → identical receipt hash (test in `tests/lattice.test.ts`). Backward
  compatible; connectors with real per-signal provenance may still set their own `ts`.
- **M2 — resolved.** Build 2 plan checkboxes ticked; Firecrawl items moved to a "Deferred" block.
- **m1 — resolved.** README notes `claim` vs `query` can judge different strings.
- **m3 — resolved.** Added a golden test locking `cohort retention` → `repeat_purchase` and
  `cohort analysis` → `market_expansion` (kept current order; intent documented).
- **m6 / s3 — resolved.** Added tests for `claimId` on the `runLattice` receipt and for composing
  `searchDelegate` + `claim` + `evidence` in one run.
- **s1 — resolved.** Classifier explanation says "low-certainty" instead of "low-confidence".
- **s2 — resolved.** Admin doc wording aligned to `evidenceCoverageScore`.
- **m5 — documented.** Added a comment clarifying `normalizeEvidence` discriminator precedence.
- **m2 / m4 / s4 — acknowledged, no change.** Rule-based classifier fallback, `supply_entry`
  being taxonomy-only (vision-intended), and the empty-`requiredEvidence` edge (unreachable via
  ladder defaults) are documented as-designed.

Test count after follow-ups: **52/52 passing**; `tsc` clean.

## Second audit round (post-v0.4.1)

Full re-audit returned **Approve** with one major caveat and doc nits. Actions taken:

- **M1 (search recency leaked wall-clock) — fixed in code.** `ClaudeSearchConnector`'s
  `implementation_readiness` anchored recency to `Date.now()`, so search runs with dated
  (`publishedAt`) results still varied over calendar time even with `options.timestamp` set.
  Now anchored to the run timestamp (parsed from the connector context), which is also more
  correct (recency as-of the run, not as-of scoring). Added a dated-search reproducibility test
  in `tests/lattice-search-delegate.test.ts`.
- **m1 / m2 — fixed.** Removed the stale "Mock stamps with new Date()" test comment and the
  stale "low-confidence" block comment in the classifier.
- **s3 — locked.** Added a matcher test for the vacuous `requiredEvidence: []` edge (Supported,
  score 0) — unreachable via ladder defaults but now intentional.
- **m3 — documented.** README/CHANGELOG note that custom connectors must honor
  `context.timestamp` (or pin their own signal `ts`) for reproducibility.
- **m4 — acknowledged, no change.** Standalone `verifyClaim`/`matchSufficiency` default `ts` to
  wall clock; not on the claim-less lattice receipt path.

Test count after this round: **55/55 passing**; `tsc` clean. The only remaining wall-clock on the
hashed path is the single intentional `new Date()` fallback in `runLattice` when no
`options.timestamp` is supplied.

## Suggestions for future builds

- Ship a reference `AsyncClaimClassifier` (LLM-driven) so domain-general claims classify beyond
  the keyword fallback.
- Layer 2 (Claim-Performance Ledger) needs the stable claim-ID thread; `claimId` is already
  carried on `ClaimSpec` / `SufficiencyVerdict` and `LatticeOptions` as the seam.
- Consider a `saturation` / `durability` evidence concept (vision §4) when Layer 2 lands.
