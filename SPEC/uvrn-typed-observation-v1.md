# UVRN Typed Observation Specification v1 (`uvrn-typed-observation-v1`)

**Status:** Normative (additive) · **Date:** 2026-07-26 · **Generation:** v4 / Wave 2 BP-19  
**Closes (specification layer):** untyped float comparisons; document-counted agreement; silent date conflation — as named in WS-PROV-003  
**Reference implementation:** deferred to BP-20 (`@uvrn/core`, `@uvrn/consensus`, `@uvrn/receipt` as mapped below)  
**Does not replace:** `SPEC/uvrn-measurement-v1.md` (measurement *verdicts*), `SPEC/uvrn-receipt-v1.md` (hash contracts)

The words MUST, MUST NOT, SHOULD, and MAY are used in the RFC 2119 sense.

---

## 0. Amend-or-new decision

**Decision: NEW document** — this file — with a **minimal pointer amend** in `SPEC/uvrn-measurement-v1.md`.

**Reasoning.** `uvrn-measurement-v1` locks starter measurement *verdicts* (`agree` / `disagree` / `conflict` / `potential`) and already owns `MeasurementSource.kind` as `numeric` | `categorical` | `boolean` | `range`. Typed quantity dimensions (money, percentage, …), three dates, SDMX observation status, W3C PROV relations, stake, and code-list versioning are a distinct protocol surface. Folding them into measurement-v1 would either redefine `kind` (honesty failure — Adversary A1/A5) or bury a second axis under the same name. A new document keeps verdict semantics stable and cites external standards once.

---

## 1. Vocabulary collision table (normative)

| Field | Owner | Meaning | Must not be confused with |
|---|---|---|---|
| `NetworkReceipt.kind` | `uvrn-receipt-v1` §2.4 / §3 | Receipt-type enum (`delta` \| `master` \| …). **Required and hashed** under `uvrn-receipt-4`. | Quantity dimension |
| `MeasurementSource.kind` | `uvrn-measurement-v1` §1 | Evidence shape: `numeric` \| `categorical` \| `boolean` \| `range`. | Quantity dimension; receipt type |
| **`quantityKind`** | **this document** | Quantity/dimension class of a numeric observation: `money` \| `percentage` \| `count` \| `date` \| `trend` \| `quantity`. | Either `kind` above |

Implementations MUST use the name `quantityKind` (or a nested object field that is **not** named `kind`) for the axis this document defines. Shipping this axis under bare `kind` is a protocol honesty failure.

---

## 2. External standards (cite, do not fork)

| Axis | Standard | Version / edition pinned for this SPEC | Role |
|---|---|---|---|
| Units | UCUM — *The Unified Code for Units of Measure* | UCUM 2.1 (FHIR / Regenstrief common citation); codes are UCUM expressions | Dimension and unit of measure |
| Observation status | SDMX Code List `CL_OBS_STATUS` | SDMX 2.1 `CL_OBS_STATUS` (codes A, E, P, F, I, U, V as used below) | Observation status code |
| Provenance relations | W3C PROV | PROV-DM / PROV-O (W3C Recommendation 30 April 2013) | Host-declared derivation relations |

UVRN MUST NOT invent parallel vocabularies for units, observation status, or provenance relations. Stake has no mature external standard; UVRN defines a **small** observational axis (§7).

Each receipt that carries any of these codes MUST record which code-list / edition it was written against (§8).

---

## 3. Typed observation shape (conceptual)

A *typed observation* is host-declared evidence about one quantity. Conceptual members (names normative for new surfaces; existing frozen envelopes are not reshaped — §9):

| Member | Required? | Notes |
|---|---|---|
| `value` | when numeric | Finite JSON number; `NaN` / `Infinity` MUST NOT appear in any hashed payload |
| `quantityKind` | SHOULD when `value` present | Enum in §1 |
| `unit` | SHOULD when comparable | UCUM code string (citation §2) |
| `publishedAt` | optional | ISO 8601 — when the document / statement was published |
| `measuredAt` | optional | ISO 8601 — when the quantity was measured or asserted as observed |
| `appliesTo` | optional | Period or instant the value is about (ISO 8601 instant or interval encoding as string) |
| `obsStatus` | optional | SDMX `CL_OBS_STATUS` code (§5) |
| `prov` | optional | Host-declared PROV relations (§6) |
| `stake` | optional | Declared interest code (§7) |
| `codeLists` | SHOULD when any external code present | Edition pins (§8) |

`MeasurementSource.kind` (evidence shape) remains as in `uvrn-measurement-v1`. It is orthogonal to `quantityKind`.

---

## 4. Dimension vectors and comparability

Two numeric observations are **comparable** only when:

1. Both carry a host-declared UCUM `unit` (or both carry `quantityKind` values whose pinned default UCUM codes are defined and equal in dimension), **and**
2. Their **dimension vectors match** (UCUM commensurability: same kind of quantity after cancellation of dimensionless factors).

Cross-dimension comparison MUST be **refused**, not silently performed.

### 4.1 Refusal result (normative shape for implementers)

A comparability refusal MUST be a first-class result with **no delta value entering scoring**. Minimum fields:

```
ComparabilityRefusal {
  type: 'comparability-refusal'
  reason: 'dimension-mismatch' | 'missing-unit' | 'inferred-unit-ineligible'
  left:  { sourceId?, quantityKind?, unit? }
  right: { sourceId?, quantityKind?, unit? }
}
```

A tagged warning attached to a still-computed delta MUST NOT satisfy this rule.

### 4.2 Text-inferred units are non-authoritative

Consensus text guesses (e.g. pattern matches for `%`, `USD`, `BTC`, `ETH`, `SOL`) MUST NOT satisfy comparability. Even when a guess string coincides with a UCUM code, an **inferred** unit is ineligible (`reason: 'inferred-unit-ineligible'`). Host-declared UCUM only.

Example UCUM codes (informative, not an exhaustive fork):

| `quantityKind` | Example UCUM |
|---|---|
| `money` | `[USD]`, `[EUR]` (currency units as UCUM annotations) |
| `percentage` | `%` |
| `count` | `1` (unity) or countable unit |
| `date` | — use `quantityKind: date` with temporal fields; do not treat calendar years as dimensionless floats for delta |
| `trend` | host-declared; often dimensionless ratio |
| `quantity` | explicit UCUM required |

---

## 5. Three dates

| Field | Meaning | Drives |
|---|---|---|
| `publishedAt` | When the source document / statement was published | Document age (not measurement freshness) |
| `measuredAt` | When the quantity was measured or observed | **Recency / freshness** of the observation |
| `appliesTo` | The period or instant the value is about | **Forecast resolution** and period alignment |

### 5.1 Partial presence

| Present | Behavior |
|---|---|
| only `publishedAt` | MUST NOT be treated as `measuredAt`. Freshness MUST NOT treat publish time as measurement time. |
| only `measuredAt` | Freshness MAY use it. `appliesTo` unknown. |
| only `appliesTo` | Period known; freshness from measurement unknown unless `measuredAt` present. |
| BP-15 `timestampSource: 'inferred'` | Remains an honesty tag: the timestamp was filled by inference. Inferred timestamps MUST NOT earn full freshness credit as if host-declared `measuredAt`. |

One date MUST NOT carry three meanings.

---

## 6. Observation status (SDMX `CL_OBS_STATUS`)

Adopted codes (cite SDMX; do not redefine meanings beyond the rules below):

| Code | Label (informative) |
|---|---|
| `A` | Normal |
| `E` | Estimated |
| `P` | Provisional |
| `F` | Forecast |
| `I` | Imputed |
| `U` | Low reliability |
| `V` | Unvalidated |

### 6.1 Normative rules (implementers get these wrong)

1. **`F` applies only to future periods** relative to `appliesTo` (or, if absent, relative to the evaluation time the host declares). A forecast that has been backfilled over a period that has since elapsed is **`I` (imputed), not `F`**.
2. **Forecasts NEVER pool into a consensus with observations.** A predicted number and a measured number are different kinds of thing. Averaging them is forbidden. Implementations MUST exclude `obsStatus: F` (and any host-declared forecast equivalent) from observation pools at every wired entry point (ranked sources, agreement scoring, starter measurements that consume the same pool — BP-20 MUST name each wired entry point in evidence).

---

## 7. Provenance (W3C PROV) — host-declared only

Adopted relation names (PROV-O / PROV-DM citation):

- `wasDerivedFrom`
- `hadPrimarySource`
- `wasQuotedFrom`
- `wasRevisionOf`
- `wasAttributedTo`

### 7.1 Inference ban

- Provenance is **host-declared only**. UVRN MUST NOT infer PROV relations from text, URL similarity, or value equality.
- An undeclared relationship stays **`unknown`**. It MUST NOT be upgraded to “independent” or to any PROV edge because nothing said otherwise.
- **Unknown MUST NOT mean dedupe.** Two undeclared sources with identical values remain two origin votes unless the host declares a PROV relation that collapses them.

### 7.2 Origin-based agreement

Agreement counts **distinct origins**, not documents.

- Restatements (e.g. four articles quoting one BLS print, when host-declared via `wasQuotedFrom` / `hadPrimarySource` / equivalent) do **not** vanish: they still count toward **transcription corroboration** and **coverage**.
- They MUST NOT count as independent confirmation of the figure itself.

### 7.3 Order relative to value-similarity

Normative order for BP-20:

1. Apply host-declared PROV to determine origin identity.
2. Value-similarity near-identical collapse MUST NOT create origin identity and MUST NOT upgrade `unknown` to same-origin.
3. Restatement / coverage signals are computed with awareness of that collapse, without lying about independent origin count.

---

## 8. Stake (UVRN-defined, small)

Stake is a **declared interest in the reported number**, phrased as observation — never as motive or bias verdict.

Suggested closed set (implementations MAY extend only with host-declared codes recorded in `codeLists`):

| Code | Observation (informative gloss — gloss MUST NOT enter hashed `explanation`) |
|---|---|
| `none-declared` | Host states no stake declared |
| `holds-position` | Publisher holds a position in the referenced asset / subject |
| `commercial-interest` | Publisher has a commercial interest in the figure’s reception |
| `unknown` | Not declared |

Binding law 5: possible reasons, never verdicts. “The publisher holds a position” is allowed as observation; “the publisher is biased” is forbidden.

---

## 9. Code-list versioning

When a receipt carries UCUM units, SDMX obs-status, PROV relations, or UVRN stake codes, it SHOULD include:

```
codeLists: {
  ucum?: string,           // e.g. 'ucum-2.1'
  clObsStatus?: string,    // e.g. 'sdmx-2.1/CL_OBS_STATUS'
  prov?: string,           // e.g. 'w3c-prov-20130430'
  stake?: string           // e.g. 'uvrn-stake-1'
}
```

A receipt that emits `obsStatus: 'E'` without a `clObsStatus` edition is not fully self-describing.

---

## 10. Envelope and hash-contract map (normative)

**DeltaReceipt is closed-world** (`uvrn-receipt-v1` §2.1). Fields MUST NOT be added to it. New capability wraps it. `suggestedFixes` remains the empty array inside that closed set — it MUST NOT host provenance, stake, or snapshots.

| New concern | Home (allowed) | Hash contract | Hashed? |
|---|---|---|---|
| `quantityKind`, UCUM `unit`, three dates, `obsStatus`, `prov`, `stake`, `codeLists` on consensus/host source objects | Consensus / MCP host source / measure input attributes (additive) | Not DeltaReceipt | Per parent object rules |
| Structured codes on `MeasurementResult` optional members | MasterReceipt measurements | §2.2 — **every present member hashed** | YES if present — use **codes only**, no interpretive prose |
| Interpretive gloss / “possible reasons” | `humanView` / non-hashed view envelopes only | Outside §2.1–§2.4 assembly | MUST NOT |
| Snapshot prose (BP-22) | `humanView` only | Outside hash assembly | MUST NOT enter `tags`, `narrative`, or `suggestedFixes` |
| `@context` / JSON-LD framing (BP-21) | Projection object graph (separate) | Outside frozen lists | MUST NOT |

### 10.1 `MeasurementResult.explanation`

`explanation` is already a hashed interpretation surface under MasterReceipt §2.2. Stake phrasing, obs-status glosses, and possibility-shaped prose MUST NOT be placed there for these axes. Prefer structured code fields; leave prose to non-hashed views.

### 10.2 `HumanView.provenance` vs W3C PROV

Existing `HumanView.provenance` means integrity / signature honesty vocabulary. It MUST NOT be conflated with W3C PROV relations (`wasDerivedFrom`, …). Implementers and snapshot copy MUST keep the two words distinct in user-facing text.

---

## 11. JSON-LD boundary (law for BP-21)

`@context` and framing live **outside** the frozen hash field lists (`drvc3-receipt-1` §2.3, `uvrn-receipt-4` §2.4, and must not be injected into MasterReceipt §2.2 members or DeltaReceipt §2.1).

- Receipts keep hashing under JCS exactly as today.
- The linked-data form is a **projection** of a receipt — a **separate object graph** — never the input to its hash.
- In-place mutation of a receipt object that will be hashed (e.g. assigning `receipt['@context']`) is forbidden even if some contracts ignore unknown fields, because `payload` and MasterReceipt members are hashed.
- Projection MUST NOT mint PROV edges for undeclared relationships.
- Context documents are offline / committed local only (no remote fetch at verify time).

---

## 12. Honesty vocabulary

- Hash recompute alone is **integrity-checked**.
- **Verified** requires integrity AND a producer signature that checks out (`uvrn-signing-v1`).
- This document introduces no claim of verification from typing or provenance alone.

---

## 13. Out of scope (left to later units)

| Topic | Unit |
|---|---|
| UCUM comparability implementation, origin counting code, negative tests | BP-20 |
| Case-bank score-channel movement explanations | BP-20 |
| JSON-LD projection package placement | BP-21 |
| Idea snapshots catalogue and model seam | BP-22 |
| Per-origin track records / store family | BP-23 (Admin-gated) |

---

## 14. Compatibility

- Existing golden vectors MUST continue to pass byte-identically.
- Frozen hash field lists MUST NOT change.
- Absence of typed-observation fields on legacy receipts is valid; readers treat missing axes as unknown / undeclared.

### 14.1 Additive diagnostic goldens (informative)

Messy short-horizon market forecast cases for typed-observation realism live in  
`SPEC/vectors/typed-observation-forecast-realism.json` (BP-v2.1-LATER-D5).  
These are **diagnostic** vectors — not receipt hash contracts — and MUST NOT be used to justify silent threshold retunes.
