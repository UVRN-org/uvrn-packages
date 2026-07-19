# UVRN Stance Evidence Specification v1 (`uvrn-stance-v1`)

**Status:** Proposed normative contract · **Date:** 2026-07-19 · **Generation:** v4 additive extension  
**Companion specs:** `uvrn-measurement-v1.md` · `uvrn-receipt-v1.md`  
**Decision record:** `ADR-011-stance-evidence.md`

This specification defines explicit stance evidence, the quorum that permits it to drive
measurement, its mapping into the existing measurement rules, and the verdict vocabulary shared
by protocol and presentation layers. It adds no field to a frozen receipt or hash field list.

The words MUST, MUST NOT, SHOULD, and MAY are used in the RFC 2119 sense.

---

## 1. Design law

1. **Explicit evidence only.** A host supplies stance fields as first-class source data. Producers
   MUST NOT infer stance from a title, URL, snippet, prominence score, or other prose at this seam.
2. **Dual axis.** Stance is the agreement axis when quorum is met. Prominence, credibility,
   recency, and coverage remain weighting/quality inputs and MUST NOT be relabeled as stance.
3. **Honest fallback.** If stance quorum is missed, the existing prominence path runs unchanged
   and provenance records the fallback. A consumer MUST NOT claim that stance was measured.
4. **Additive evolution.** Existing `DeltaReceipt`, `MasterReceipt`, `NetworkReceipt`, hash field
   lists, signatures, canonicalization, and no-stance output remain unchanged. New hashed surfaces
   MUST use `@uvrn/receipt` canonicalization and the shared conformance vectors.

---

## 2. Source fields

The following fields are optional, additive members of a source schema:

| Field | Type and allowed values | Meaning |
|---|---|---|
| `stanceValue` | finite number in `[-1, 1]` | Numeric position used by `agree` and `disagree`; `-1` is fully opposing and `1` is fully supporting. |
| `stanceLabel` | `supports \| opposes \| mixed \| neutral \| insufficient` | Categorical description supplied by the producer. |
| `stanceConfidence` | finite number in `[0, 1]` | Producer confidence in the supplied stance. |
| `stanceEvidence` | string | Grounding text that explains the position. |

Values outside these domains are invalid at an untrusted input boundary. Internal consumers MUST
not clamp, repair, or guess invalid values.

`stanceValue` and `stanceLabel` are independent supplied facts in v1. A consumer MUST NOT derive
one from the other. This avoids inventing a universal numeric value for `mixed` or `neutral`.

### 2.1 Grounded source

A source is **grounded** if and only if all three conditions hold:

1. `stanceLabel !== 'insufficient'` and `stanceLabel` is a valid label;
2. `stanceEvidence.trim().length > 0`;
3. `stanceConfidence` is finite and `stanceConfidence >= 0.6`.

Missing or invalid fields fail the relevant condition. `stanceValue` is not part of the grounded
test; a grounded source without a valid numeric value can participate in an eligible categorical
projection but cannot be guessed into numeric agreement math.

Ungrounded sources MUST be excluded from every stance-axis measurement projection. They remain
present in source counts, node status, completeness, weighting, and other non-stance records.
Their exclusion MUST NOT be rewritten as agreement, disagreement, or an error.

---

## 3. Activation quorum and provenance

The normative defaults, lifted from the production stance seam (D6), are:

| Constant | Value |
|---|---:|
| `STANCE_QUORUM_SOURCES` | `4` |
| `STANCE_QUORUM_GROUNDED` | `3` |
| `STANCE_CONFIDENCE_MIN` | `0.6` |

For one claim run:

```text
sourceCount   = number of supplied source records
groundedCount = number of sources satisfying §2.1
quorumMet     = sourceCount >= 4 AND groundedCount >= 3
```

The stance axis MUST activate exactly when `quorumMet` is true. Otherwise the producer MUST use
the pre-existing prominence path byte-for-byte.

Every stance-capable run MUST record this additive provenance block on the host run record or on
another non-frozen envelope owned by that host:

```text
stanceMode {
  evidenceAxis:       'stance' | 'prominence'
  sourceCount:        integer >= 0
  groundedCount:      integer >= 0
  requiredSources:    4
  requiredGrounded:   3
  confidenceFloor:    0.6
  quorumMet:          boolean
  fallbackReason?:    'source-quorum-missed' | 'grounded-quorum-missed'
}
```

When both thresholds are missed, `fallbackReason` MUST be `source-quorum-missed`; otherwise the
missed threshold names the reason. `fallbackReason` MUST be absent when quorum is met.
`evidenceAxis` MUST be `stance` if and only if `quorumMet` is true.

This block MUST NOT be inserted into the frozen `drvc3-delta-1` payload. A producer that has no
additive provenance container MUST retain the legacy output exactly rather than mutate a frozen
surface; the containing host integration owns provenance adoption.

---

## 4. Mapping into existing measurement rules

The named seam is:

```text
stanceToMeasurementSources(sources: readonly StanceSource[]):
  StanceMeasurementProjection
```

It is a pure mapping. It MUST preserve source order and MUST NOT mutate input sources.

### 4.1 Numeric projection: `agree` and `disagree`

For each grounded source with a valid finite `stanceValue`, emit one `MeasurementSource`:

```text
{
  id: source.id,
  kind: 'numeric',
  value: source.stanceValue,
  label: source.label,
  ts: source.ts,
  status: source.status,
  attributes: { field: 'claim-stance', stanceLabel: source.stanceLabel }
}
```

Omit absent optional members. The existing `uvrn-measurement-v1` §2 agreement score and §3.1/§3.2
starter rules run unchanged over this projection. Fewer than two numeric projected sources yields
the existing `insufficient-data` result; a value MUST NOT be fabricated from a label.

### 4.2 Categorical projection: `conflict`

For each grounded source whose label is `supports` or `opposes`, emit one
`MeasurementSource` with:

```text
{
  id: source.id,
  kind: 'categorical',
  assertion: source.stanceLabel,
  label: source.label,
  ts: source.ts,
  status: source.status,
  attributes: { field: 'claim-stance' }
}
```

`mixed` and `neutral` are not mutually exclusive outcomes and therefore MUST NOT be projected into
the categorical conflict check. This preserves the locked §3.3 rule: two projected assertions on
the same field conflict exactly when one is `supports` and the other is `opposes`. Numeric spread
alone remains `disagree`, never `conflict`.

Fewer than two categorical projected sources yields the existing `insufficient-data` result. Two
or more projected sources with only one assertion value yields `none`, as §3.3 already specifies.

### 4.3 `potential`

The `potential` starter remains governed exclusively by `uvrn-measurement-v1` §3.4 history. This
specification does not derive or rewrite agreement history.

---

## 5. Fallback and no-stance compatibility

If quorum is missed, all stance fields MUST be ignored by the agreement engine for that run and
the exact pre-program prominence path MUST execute. Partial stance evidence MUST NOT be blended
with prominence into a new axis.

If no stance fields are supplied:

- `groundedCount` is `0`;
- the prominence fallback applies;
- every legacy bundle, score, receipt, hash, source ordering, explanation, and outcome MUST be
  byte-identical to the unmodified 4.0.0 behavior;
- consumers that do not yet support `stanceMode` continue to receive the legacy artifact.

`insufficient-data` semantics from `uvrn-measurement-v1` §4 are unchanged. Missing stance never
becomes a negative stance and never becomes an engine error.

---

## 6. Tier-0 verdict vocabulary and legal mappings

Tier-0 is closed machine truth. Hashes and simple consumers key only on these existing core terms.
The engine outcome is coarser than a measurement verdict, so presentation MUST use the primary
measurement verdict together with the engine outcome. It MUST NOT infer a human verdict from
`indeterminate` alone.

| Measurement Tier-0 | Required engine outcome | Dash human Tier-0 | Meaning |
|---|---|---|---|
| `agree` | `consensus` | `align` | Available evidence converges under the active axis. |
| `disagree` | `indeterminate` | `split` | Numeric evidence materially diverges. |
| `conflict` | `indeterminate` | `contradict` | Mutually exclusive categorical outcomes were asserted. |
| `potential` | `indeterminate` | `early` | Agreement is rising but is not settled. |
| `insufficient-data` | `indeterminate` | `insufficient` | The requested relationship could not be measured honestly. |

These five rows are the only legal Tier-0 cross-layer mappings for a primary stance measurement.
In particular:

- `indeterminate` MUST NOT render as `split`, “divergence,” or “they disagree” unless the primary
  measurement verdict is `disagree`;
- `indeterminate` plus `conflict` renders `contradict`;
- `indeterminate` plus `insufficient-data` renders `insufficient` (“couldn't tell”);
- “couldn't tell” and “they disagree” are different truths and MUST remain distinguishable;
- legacy non-firing measurement values (`none`, `no-agreement`) are not Tier-0 findings and MUST
  render neutrally as “no signal,” never as any of the five findings above.

When multiple starter measurements fire, the existing presentation precedence remains normative:
`conflict` before `disagree` before `agree` before `potential` before `insufficient-data`. This
selects one headline without discarding the other recorded measurement results.

An inconsistent measurement/outcome pair MUST be rejected at a stance-aware composition boundary
rather than silently remapped.

---

## 7. Tier-1 descriptor library

Tier-1 is an open, registered descriptor library for richer agent reporting. A descriptor rides
alongside its Tier-0 term and never replaces it.

```text
VerdictDescriptor {
  term: string
  parent: 'align' | 'split' | 'contradict' | 'early' | 'insufficient'
  definition: non-empty string
}
```

### 7.1 Registration and validator rules

A conforming validator MUST apply every rule below:

1. `term` MUST match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (lowercase kebab-case).
2. `term` MUST be unique in the registry.
3. `parent` MUST be exactly one Tier-0 dash term.
4. `definition.trim()` MUST be non-empty.
5. `term` MUST NOT equal a Tier-0 term.
6. `term` MUST NOT synonym-shadow a core term. The reserved shadow set is:
   `agree`, `agreement`, `aligned`, `alignment`, `consensus`, `disagree`, `disagreement`,
   `diverge`, `divergence`, `split`, `conflict`, `contradict`, `contradiction`, `potential`,
   `early-signal`, `indeterminate`, `insufficient`, `insufficient-data`, `unknown`.
7. The descriptor's definition and emitted copy MUST NOT overstate its parent. A child of
   `insufficient` cannot claim agreement or disagreement; a child of `split` cannot claim direct
   contradiction; a child of `early` cannot claim settled consensus.
8. Outputs carrying a descriptor MUST also carry its Tier-0 parent. Unknown descriptors MAY be
   displayed as tags but MUST NOT alter the Tier-0 verdict.

The honesty vocabulary in `uvrn-receipt-v1` §5 also applies: for example,
`integrity-checked` MUST NOT be replaced by `verified`.

---

## 8. Conformance vectors

`SPEC/vectors/` contains four v1 fixtures:

- `stance-quorum-met.json` — stance activation and numeric agreement;
- `stance-quorum-fallback.json` — grounded quorum miss and explicit prominence fallback;
- `stance-opposing-conflict.json` — opposing categorical assertions through locked §3.3;
- `stance-no-stance-regression-4.0.0.json` — frozen output from the unmodified legacy chain.

BP-02 makes the first three executable. The fourth is frozen now: subsequent changes MUST
reproduce its expected legacy output byte-for-byte.
