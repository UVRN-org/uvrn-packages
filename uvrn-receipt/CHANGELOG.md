# @uvrn/receipt — Changelog

## Unreleased

### Added
- Actionable explanations (BP-v2.1-LATER-D3): `buildActionableExplanation()` + optional
  `HumanView.actionableExplanation` from `toHumanView` when split/disagree facts are
  present. Drivers answer “what would move disagree → agree?” with measurement /
  stance / D2 diagnostic / optional spread anchors. Render-only; no hashed field-list
  changes; no invented ranking policy.
- Source-quality diagnostics (BP-v2.1-LATER-D2): `assessSourceQuality()` + optional
  `HumanView.sourceQualityDiagnostics` when hosts supply `sourceQualityInputs` via
  `toHumanView` options or a non-hashed envelope member. Weak/inconsistent
  `stanceLabel` / `evidenceScore` / `credibility` are machine-checkable; no hashed
  field-list changes; no fake high-confidence language when inputs are weak.

## [4.1.0] - 2026-07-19

### Closing release
- Program closing npm release: ships parked canon + land-touched receipt surface (REF/STANCE).

### Added / Changed (landed)
- Add `canonicalClaimId()` and its locked Unicode-aware normalizers for the D9 cross-run identity,
  exported from the package root and `@uvrn/receipt/identity`. The helper uses the shared
  canonicalizer (ADR-006) and changes no frozen hash field list (ADR-010).
- Export the closed D8 Tier-0 cross-layer verdict map and stateless Tier-1 `validateDescriptor()` registration validator (ADR-011).
- `toHumanView()` renders stance-axis support/oppose counts and valid-parent Tier-1 descriptors alongside the unchanged Tier-0 verdict. No declared hash field list or canonicalizer changed (ADR-006/ADR-010).
- `canonicalize()` now delegates to the environment-pure
  `@uvrn/core/canonical-serialize-2` subpath and re-exports the shared strict API.
- True sparse array holes now serialize as JSON `null` together with core and identity.
- Valid-JSON receipt bytes and golden hashes remain unchanged; non-finite values reject.
- Receipt schemas, declared hash fields, and seal semantics are unchanged.

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

Initial release. The canonical receipt object model per `SPEC/uvrn-receipt-v1.md` and
`SPEC/uvrn-signing-v1.md`:

- `NetworkReceipt` envelope (`schemaVersion: 'uvrn-receipt-4'`) with declared-field-list hashing
  (additive unknown-field rule).
- RFC 8785 (JCS) `canonicalize()` — the single canonicalization implementation for packages,
  worker, and site; legacy `drvc3-receipt-1` hash-input assembly included so the worker can
  retire its duplicate.
- Ed25519 producer signing (`uvrn-sig-1`): `signReceipt` / `verifySignature` /
  `verifyReceiptFull` (integrity + signature, honest-vocabulary result shape).
- Topic taxonomy (starter domains + open `custom/*`, normalize-never-reject).
- Layer D vocabulary module: verdict map, domain framing profiles, divergence explainer,
  score plain-meanings, master-narrative template.
- `toHumanView()` — UI-agnostic human rendering (headline, verdict tone, sources, gaps,
  provenance, how-to-verify).
- `wrapDeltaReceipt` / `wrapMasterReceipt` envelope builders; v3 payloads stay byte-for-byte
  verifiable through the frozen `@uvrn/core` path.
- Golden-vector conformance suite against `SPEC/vectors/` (canonicalization, network receipt
  hash + signature incl. must-fail tampering cases, master hash, HumanView).

### Phase 2 additions (2026-06-10)

- `enrichMeasurements()` — stamps Layer D `humanExplanation` onto measurement results; call
  before `buildMasterReceipt` so the human language lives inside the hashed envelope (B5.2).
- `verifyDetachedSignature()` — verify a producer signature from `{receiptHash, schemaVersion,
  signature}` alone; for registries and reputation systems that hold metadata, not envelopes.
