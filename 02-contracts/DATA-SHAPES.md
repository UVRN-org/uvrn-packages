# Data shapes — stance evidence seam

**Status:** Proposed contract for BP-02
**Normative source:** `SPEC/uvrn-stance-v1.md`
**Decision:** `SPEC/ADR-011-stance-evidence.md` (proposed; applies ADR-005/006/010)

This file names the package seam before implementation. The declarations are contract notation,
not runtime code.

```ts
type StanceLabel =
  | 'supports'
  | 'opposes'
  | 'mixed'
  | 'neutral'
  | 'insufficient';

interface StanceSource {
  id: string;
  label?: string;
  ts?: string;
  status?: 'on' | 'off' | 'unavailable';

  // Optional additive source fields. Untrusted boundaries validate their domains.
  stanceValue?: number;       // finite, -1 <= value <= 1
  stanceLabel?: StanceLabel;
  stanceConfidence?: number;  // finite, 0 <= value <= 1
  stanceEvidence?: string;
}

interface StanceMeasurementProjection {
  // Grounded sources with a valid stanceValue, in input order.
  numeric: ReadonlyArray<MeasurementSource>;
  // Grounded supports/opposes sources only, in input order.
  categorical: ReadonlyArray<MeasurementSource>;
}

declare function stanceToMeasurementSources(
  sources: ReadonlyArray<StanceSource>
): StanceMeasurementProjection;
```

`MeasurementSource` is the existing `@uvrn/core` structural contract. The mapping is pure,
preserves source order, does not mutate input, and adds no canonicalizer.

## Projection rules

For a grounded source with a valid `stanceValue`, `numeric` contains:

```ts
{
  id: source.id,
  kind: 'numeric',
  value: source.stanceValue,
  label: source.label, // when present
  ts: source.ts,       // when present
  status: source.status, // when present
  attributes: {
    field: 'claim-stance',
    stanceLabel: source.stanceLabel
  }
}
```

For a grounded source with `stanceLabel` equal to `supports` or `opposes`, `categorical`
contains:

```ts
{
  id: source.id,
  kind: 'categorical',
  assertion: source.stanceLabel,
  label: source.label, // when present
  ts: source.ts,       // when present
  status: source.status, // when present
  attributes: { field: 'claim-stance' }
}
```

A source is grounded exactly when its valid label is not `insufficient`, its trimmed evidence is
non-empty, and its finite confidence is at least `0.6`. Ungrounded sources appear in neither
array. `mixed` and `neutral` never appear in `categorical`.

## Activation result

The consuming consensus seam records:

```ts
type StanceFallbackReason =
  | 'source-quorum-missed'
  | 'grounded-quorum-missed';

interface StanceMode {
  evidenceAxis: 'stance' | 'prominence';
  sourceCount: number;
  groundedCount: number;
  requiredSources: 4;
  requiredGrounded: 3;
  confidenceFloor: 0.6;
  quorumMet: boolean;
  fallbackReason?: StanceFallbackReason;
}
```

`evidenceAxis` is `stance` exactly when `sourceCount >= 4 && groundedCount >= 3`. If both
thresholds miss, `fallbackReason` is `source-quorum-missed`; otherwise it identifies the grounded
miss. The reason is absent when quorum is met.

This metadata belongs only on an additive consensus/provenance surface. It MUST NOT be inserted
into the frozen `DeltaReceipt` payload.

---

## Reference-spine hygiene (BP-08)

### Claim identity names

At seams where both meanings can occur, adapters use `runClaimId` for the existing per-run
protocol reference and `canonicalClaimId` for the cross-run value from
`@uvrn/receipt` (`SPEC/uvrn-claim-id-v1.md`, D9). A bare `claimId` is legacy input that MUST be
mapped explicitly; it is not enough information to merge identities. Additive carriage MUST NOT
change a frozen receipt hash field list (ADR-010).

### `protocolVersion` single source on the next site touch

The site package loader currently derives `uvrn-packages@<version>` while a dash route also
re-derives or restamps that reference. When BP-03 or a later site unit next changes those files,
the loader boundary MUST own the derivation from the resolved `@uvrn/receipt` package generation
and expose the resulting `protocolVersion` capability. Dash routes and adapters MUST consume that
capability unchanged; they MUST NOT read package metadata or format the version independently.

This is a recorded cross-repo adoption rule only. BP-08 does not edit `uvrn-home`, migrate stored
records, or alter a package hash/sign surface (D2, D4, ADR-006, ADR-010).
