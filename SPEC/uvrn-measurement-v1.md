# UVRN Measurement Specification v1 (`uvrn-measurement-v1`)

**Status:** Normative · **Date:** 2026-06-10 · **Generation:** v4 / fable-refactor-1
**Closes:** audit majors 1–3 in `admin/audits/audit-trend-engine-layer-v1-FINAL-2026-06-04.md`
(`conflict` semantics, `potential` semantics, MeasurementInput thinness)
**Reference implementation:** `@uvrn/measure` (contract types in `@uvrn/core`)

A *measurement* is a pure relationship check over evidence about one claim. This document locks
the decision-complete semantics of the four starter measurements and the `insufficient-data`
verdict. The vocabulary is open — hosts may add measurement types by implementing the same
contract — but the four starters mean exactly what this document says, everywhere.

---

## 1. The contract (from `@uvrn/core`, unchanged shape)

```
MeasurementSource {
  id: string
  kind?: 'numeric' | 'categorical' | 'boolean' | 'range'
  value?: number                      // kind=numeric
  assertion?: string                  // kind=categorical|boolean
  range?: { min: number, max: number }   // kind=range
  attributes?: Record<string, unknown>   // provenance; attributes.field|key|metric = comparison field
  label?: string, ts?: string, status?: 'on'|'off'|'unavailable'
}

MeasurementInput  { claim: string, sources: MeasurementSource[], context?: Record<string, unknown> }
MeasurementResult { type, verdict, confidence: 0..1, explanation, evidenceRefs: string[] }
```

**Field comparability rule:** two sources are comparable for `conflict` iff they assert the same
field. The field is `attributes.field ?? attributes.key ?? attributes.metric`, defaulting to
`'default'` when none is present. (This resolves audit major 3: the categorical/range context the
v3 type already carries — `kind`, `assertion`, `range`, `attributes` — is hereby normative, and
producers SHOULD set `attributes.field` whenever evidence covers more than one quantity.)

**Usable source:** a source whose evidence member matches its `kind` (or whose `kind` can be
inferred from the populated member). Sources with `status` `off`/`unavailable` and no evidence are
not usable, but MUST still be reported in master-receipt `nodes` — recorded, not hidden.

### 1.1 Context keys (all optional, measurement-defined)

| Key | Default | Used by |
|---|---|---|
| `agreeThreshold` | `0.9` | agree, potential |
| `divergenceThreshold` | `0.1` | disagree |
| `conflictRangeTolerance` | `0` | conflict |
| `minObservations` | `3` | potential |
| `windowSize` | `3` | potential |
| `history` / `agreementHistory` | — | potential (scores 0..1, oldest first) |
| `confidenceFloor` | `0.25` | potential |

---

## 2. The agreement score (shared math)

For ≥2 numeric values `v₁..vₙ`:

```
spread = |max − min| / midpoint,  midpoint = (|min| + |max|) / 2   (spread = 0 when midpoint = 0)
score  = clamp(1 − spread, 0, 1)
```

For ≥2 categorical/boolean assertions: `score = 1` when all normalized assertions
(trim + lowercase) are equal, else `0`. Numeric evidence takes precedence when both exist.

---

## 3. The four starter measurements (normative)

### 3.1 `agree` — sources converge

- **Fires** (`verdict: 'agree'`) when the agreement score ≥ `agreeThreshold`.
- Otherwise `verdict: 'no-agreement'`, confidence = score.
- **Insufficient:** fewer than 2 usable comparable sources → `verdict: 'insufficient-data'`,
  confidence 0 (§4).

### 3.2 `disagree` — sources split (numeric divergence)

- Considers **numeric evidence only**. Categorical/range contradiction is `conflict`'s job —
  one responsibility per measurement.
- **Fires** (`verdict: 'disagree'`) when `spread > divergenceThreshold`;
  confidence = `min(1, spread)`.
- Otherwise `verdict: 'none'`, confidence = `1 − spread`.
- **Insufficient:** fewer than 2 numeric sources → `verdict: 'insufficient-data'` (§4).
- Interpretation (Layer D): a split is a *gap* — interesting, often opportunity — and is
  presentation-distinct from contradiction.

### 3.3 `conflict` — sources contradict (mutual exclusion)

**The locked rule (audit major 1):** `conflict` fires iff at least two sources asserting the
**same field** (§1) yield mutually exclusive outcomes, in exactly one of two ways:

1. **Categorical/boolean exclusion** — both sources have kind `categorical` or `boolean` and
   their normalized assertions differ.
2. **Disjoint ranges** — both sources have kind `range` and the gap between the intervals
   exceeds `conflictRangeTolerance`:
   `left.max + tol < right.min  OR  right.max + tol < left.min`.
   With the default `tol = 0` any disjoint pair conflicts; hosts widen the tolerance to demand a
   material gap. (v3 behavior = `tol 0`; the tolerance knob is additive.)

- **Numeric spread alone is NEVER `conflict`** — it is `disagree`. A 10% price difference is a
  split; "approved" vs "rejected" is a contradiction.
- Fires with `verdict: 'conflict'`, confidence 1, `evidenceRefs` = the two conflicting source
  ids (first conflicting pair in source order).
- No exclusion found → `verdict: 'none'`, confidence 0.
- **Insufficient:** fewer than 2 usable categorical/boolean/range sources →
  `verdict: 'insufficient-data'` (§4).

### 3.4 `potential` — early signal (rising, unsettled)

**The locked rule (audit major 2):** `potential` fires iff ALL of:

1. `history` contains ≥ `minObservations` agreement scores (thin history NEVER fires —
   it is `insufficient-data`, §4);
2. the last `windowSize` scores are monotonically non-decreasing with a positive net change
   (`last > first` of the window);
3. the current (latest) score is still **below** `agreeThreshold` (settled agreement is `agree`,
   not `potential`).

- **Confidence (v4 hardening):** scaled by sample size and trend strength:

```
sampleFactor = min(1, history.length / (2 × minObservations))
trendStrength = clamp((windowLast − windowFirst) / max(0.05, 1 − windowFirst), 0, 1)
confidence = clamp(current × (0.5 × sampleFactor + 0.5 × trendStrength), 0, 1) when firing
```

  When the computed confidence < `confidenceFloor`, the measurement MUST emit
  `verdict: 'insufficient-data'` instead of `'potential'` — a weak early signal is reported as
  not-enough-evidence, never overstated.
- Conditions unmet (with adequate history) → `verdict: 'none'`.

---

## 4. `insufficient-data` (normative verdict, new in v4)

Every starter measurement emits `verdict: 'insufficient-data'` (confidence 0 unless specified)
when it cannot measure: too few usable sources for its evidence type, thin history, or a
sub-floor potential signal. The explanation MUST state what was missing
("Disagree requires at least two numeric evidence values; received 1.").

Honesty rule: `insufficient-data` is a first-class recorded outcome — UIs render it as
"Not enough evidence", never as agreement or as an error.

**v3 → v4 verdict migration:** v3 emitted `'no-agreement'` (agree) or `'none'`
(disagree/conflict/potential) for these cases. The v4 behavior change is sanctioned by the audit
closure and the 4.0.0 major. Consumers of stored v3 results map old verdicts through the
`@uvrn/receipt` vocabulary module, which understands both generations.

---

## 5. Minimum statistical requirements summary

| Measurement | Minimum evidence | Below minimum |
|---|---|---|
| agree | 2 usable comparable sources | insufficient-data |
| disagree | 2 numeric sources | insufficient-data |
| conflict | 2 categorical/boolean/range sources | insufficient-data |
| potential | `minObservations` history points AND confidence ≥ `confidenceFloor` | insufficient-data |
