# Changelog

## 0.4.1

- Made receipt hashes reproducible. `DomainConnector.fetch` now accepts an optional
  `ConnectorContext { timestamp }`; `runLattice` threads the single run timestamp to every
  connector, and the bundled `MockDomainConnector` / `ClaudeSearchConnector` use it instead of
  the wall clock. Same query + same `options.timestamp` → identical receipt hash. Backward
  compatible: the context argument is optional and connectors with genuine per-signal provenance
  may still set their own `ts`.
- `ClaudeSearchConnector` now anchors `implementation_readiness` recency to the run timestamp
  instead of `Date.now()`, so search runs with dated (`publishedAt`) results are reproducible
  too — and recency is correctly measured as-of the run, not as-of scoring time.
- Note: full reproducibility requires passing `options.timestamp`, and custom connectors must
  honor `context.timestamp` (or pin their own signal `ts`).

## 0.4.0

- Added Claim ↔ Evidence Sufficiency under `src/sufficiency/`: grade evidence relative to the
  specific claim it is asked to support, independent of the V-Score.
- Added the `ClaimLevel` ladder (L1–L5), the 7-class `EvidenceClass` taxonomy, and the
  `SufficiencyVerdict` (`Supported` / `Unverified` + `evidenceCoverageScore`).
- Added `ClaimClassifier` / `AsyncClaimClassifier` / `EvidenceTagger` interfaces with zero-dep
  `RuleBasedClaimClassifier` and `DefaultEvidenceTagger` defaults.
- Added the pure `matchSufficiency` matcher (coverage-based, never re-derives delta math) and
  standalone `verifyClaim` / `verifyClaimAsync` entry points.
- Added optional `runLattice` integration: `LatticeReceipt.sufficiency` populated when
  `LatticeOptions.claim` is set; provenance evidence supplied via `LatticeOptions.evidence`.
  Additive and non-breaking — receipts without a claim are unchanged.
- Added test coverage for the classifier, tagger/bridge, matcher (worked examples), `verifyClaim`,
  and the lattice integration.

## 0.3.0

- Added optional `searchDelegate` field to `LatticeOptions`. `runLattice()` now auto-wraps a
  `SearchDelegate` in a `ClaudeSearchConnector` internally — no manual connector construction
  required.
- Connector resolution priority is `connectors[domainId]` → `connector` → `searchDelegate` →
  `MockDomainConnector`. Additive and non-breaking — existing `connector`/`connectors` callers
  are unaffected.
- Added test coverage for delegate auto-wiring, connector precedence, mock fallback, and the
  delegate error path.

## 0.2.0

- Added `ClaudeSearchConnector` under `src/connectors/search/` for manual Cowork search sessions.
- Added `SearchDelegate` and `SearchResult` types for runtime agent-driven search.
- Added connectors barrel export at `src/connectors/index.ts`.
- Added unit and smoke coverage for search connector signal derivation.

## 0.1.0

- Added first draft of `@uvrn/lattice`.
- Added provider-agnostic `DomainConnector` interface.
- Added zero-external `MockDomainConnector`.
- Added template routing, domain normalization, and `runLattice()`.
- Added six built-in lattice template stubs.
- Added smoke coverage for mock lattice runs through real `@uvrn/core` delta receipts.
