# ADR-011 — Explicit stance evidence and dual-axis consensus

**Status:** Proposed
**Date:** 2026-07-19
**Scope:** `uvrn-stance-v1` and its future package implementation
**Governing doctrine:** ADR-005, ADR-006, ADR-010

## Context

The v4 package chain currently uses prominence (`evidenceScore`) as its comparable numeric value.
That makes receipts attest similarity of visibility scores even when sources take opposing
positions on the claim. Production already extracts stance, but the package boundary drops it.

Parsing stance from source prose would repeat the title-number failure that first-class
`evidenceScore` corrected. It would also make provider text an implicit, unstable contract.

## Decision

1. Stance is supplied explicitly as first-class optional source fields:
   `stanceValue`, `stanceLabel`, `stanceConfidence`, and `stanceEvidence`.
2. The package seam is the named, pure `stanceToMeasurementSources()` mapping defined in
   `02-contracts/DATA-SHAPES.md` and `uvrn-stance-v1` (ADR-005).
3. Consensus is dual-axis when the stance quorum is met:
   - stance drives agreement, disagreement, and categorical conflict;
   - prominence, credibility, recency, and coverage continue to drive weighting and evidence
     quality.
4. The stance axis activates only at four supplied sources and three grounded sources, with a
   confidence floor of `0.6`. Below quorum, the unmodified prominence path runs and the reason is
   recorded in additive provenance.
5. A run with no stance fields is frozen to the current legacy output, including bytes, ordering,
   hashes, and outcomes.
6. No existing hash/sign field list changes. Any future hashed stance surface uses
   `@uvrn/receipt` canonicalization and the shared conformance vectors; no canonicalizer is added
   (ADR-006).
7. Public shapes evolve only through optional fields or a new version discriminator. Frozen
   receipt shapes are never mutated in place (ADR-010).
8. The stance contract lives in a separate `SPEC/uvrn-stance-v1.md`, rather than modifying the
   existing measurement specification. The measurement rules remain locked and stance is an
   additive projection into them.

## Consequences

- Hosts must pass stance deliberately; a stance word in a title or snippet has no protocol
  meaning by itself.
- Grounded numeric stance reuses existing agreement/disagreement math. Grounded
  `supports`/`opposes` labels reuse the existing categorical-exclusion conflict rule.
- `mixed` and `neutral` remain valid numeric positions but do not become mutually exclusive
  categorical assertions.
- Partial or low-confidence stance cannot silently influence the agreement axis.
- Legacy integrations remain compatible and byte-identical when stance is absent.
- BP-02 implements and characterizes the named seam; this ADR introduces no runtime behavior.

## Rejected alternatives

- **Parse stance from prose:** implicit, provider-dependent, and vulnerable to title/snippet traps.
- **Replace prominence with stance unconditionally:** breaks no-stance consumers and conflates
  agreement with evidence quality.
- **Blend partial stance with prominence:** creates a third axis whose meaning cannot be stated
  honestly and makes fallback non-deterministic.
- **Change starter measurement rules:** unnecessary; existing numeric math and categorical
  exclusion already express the required relationships.

## Approval

This ADR remains `proposed` until Shawn locks it. Implementation may be reviewed against this
decision, but a lock or superseding ADR is required before treating it as house doctrine.
