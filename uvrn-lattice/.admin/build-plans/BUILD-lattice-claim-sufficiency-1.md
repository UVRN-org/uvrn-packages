# Build Plan: Lattice Claim ↔ Evidence Sufficiency — Build 1

## `@uvrn/lattice` — Claim/Evidence Sufficiency Layer

**Package:** `@uvrn/lattice`
**Build:** 1 of N (Claim-Verification series)
**Date:** 2026-06-02
**Protocol:** Bloom Protocol v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Status:** ✅ Executed in v0.4.0
**Source vision:** [`.admin/vision/CLAIM-VERIFICATION-ENGINE-VISION.md`](../vision/CLAIM-VERIFICATION-ENGINE-VISION.md)

---

## Goal

Transcribe **Layer 1 (Claim ↔ Evidence Sufficiency)** from the Claim-Verification Engine vision
into a working, domain-general lattice ability. Grade evidence **relative to the specific claim**
it is asked to support, and emit an honest `Supported` / `Unverified` verdict. Standalone-first;
optional `runLattice` integration.

## Why it does not conflict with the rest of the protocol

`@uvrn/core` / `@uvrn/score` / `@uvrn/drift` measure **consensus** (do sources agree? — the
V-Score). Sufficiency measures **whether the right kind of evidence is present** for a claim.
Orthogonal and complementary. The verdict score is named `evidenceCoverageScore`, never
"confidence" (which already loosely means the V-Score). The matcher never re-derives delta math.

## What shipped

- `src/sufficiency/types.ts` — `ClaimLevel` (L1–L5), `EvidenceClass` (7 classes), `EvidenceItem`,
  `ClaimSpec`, `SufficiencyVerdict`, and the `ClaimClassifier` / `AsyncClaimClassifier` /
  `EvidenceTagger` interfaces.
- `src/sufficiency/ladder.ts` — `CLAIM_LADDER`, `LADDER_ORDER`, domain-general `EVIDENCE_TAXONOMY`.
- `src/sufficiency/RuleBasedClaimClassifier.ts` — zero-dep keyword classifier (no-verb → L2).
- `src/sufficiency/DefaultEvidenceTagger.ts` — zero-dep taxonomy tagger + `overrides`.
- `src/sufficiency/matcher.ts` — pure `matchSufficiency` (coverage-based `evidenceCoverageScore`, band caps).
- `src/sufficiency/bridge.ts` — `bridgeFromDomainSignals` / `normalizeEvidence` (drops the 0–100
  consensus metric so V-Score magnitude does not skew coverage scoring).
- `src/sufficiency/verifyClaim.ts` — standalone `verifyClaim` / `verifyClaimAsync`.
- Wiring: `src/types.ts` (`LatticeReceipt.sufficiency?`, `LatticeOptions.claim/claimId/evidence/
  claimClassifier/evidenceTagger`), `src/index.ts` (`export * from './sufficiency'`),
  `src/lattice.ts` (`buildSufficiency`, attached only when `options.claim` is set).
- Tests: `claimClassifier`, `evidenceTagger`, `matcher`, `verifyClaim`, `latticeSufficiency`.

## Key design decision — integrated evidence

Lattice `DomainSignal.source` values (`mock://…`, `delegate://…`, result URLs) are not provenance
vocabulary, so the default tagger cannot classify bridged signals. The `runLattice` hook
therefore **merges** `options.evidence` (explicit provenance) with bridged signals rather than
relying on the bridge alone. A bridge-only integrated run is honestly `Unverified`; tests assert
this rather than faking a verdict.

## Constraints honored

- Provider-agnostic interfaces + zero-dep defaults. Zero-external path works.
- LLM-friendly `explanation` on every output object.
- V-Score math stays in `@uvrn/core`.
- Additive / non-breaking; no new runtime/peer deps. `ClaudeSearchConnector` untouched.
- `dist/` never committed.

## Definition of done

- [x] `src/sufficiency/*` implemented
- [x] `LatticeReceipt.sufficiency` + `LatticeOptions` fields added (additive)
- [x] `verifyClaim` / `verifyClaimAsync` exported
- [x] Tests pass (48/48 across the package)
- [x] `tsc` clean
- [x] README + CHANGELOG updated, version → 0.4.0

## Deferred (future builds)

- Layer 2 (Claim-Performance Ledger — re-score over time, source-reliability memory)
- Layer 3 (Claim-as-Asset / ticker)
- Smarter claim classification (LLM `AsyncClaimClassifier` reference implementation)

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
