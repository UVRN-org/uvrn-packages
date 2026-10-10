# UVRN Probability Specification v2 (`uvrn-probability-v2`)

**Status:** Normative (draft, pre-publish) · **Date:** 2026-09-27 · **Generation:** v2.1
**Companion specs:** `uvrn-probability-v1.md` (legacy contract; market and base-rate math reused here) · `uvrn-outcome-v1.md` (optional declaration bindings) · `uvrn-receipt-v1.md` (canonicalization, hash law, envelope) · `uvrn-signing-v1.md` (Ed25519) · `uvrn-typed-observation-v1.md` (UCUM `"1"`, `quantityKind`)
**Reference implementation:** `@uvrn/probability` 0.2.0 (this monorepo; not published)
**Schemas:** `SPEC/schemas/uvrn-probability-input-2.schema.json`, `SPEC/schemas/uvrn-probability-result-2.schema.json`
**Golden vectors:** `SPEC/vectors/probability-v2.json`
**Successor:** `uvrn-probability-v3.md` adds a required fixed-offset local deadline (`question.resolveByOffset`) as a separate contract; this version is unchanged by it.

This document defines a caller-selected, receipted forecast for a standalone question definition,
in one of three modes: **market** (cited market prices), **base rate** (a cited reference class),
or **judgment** (an attributed, reasoned allocation by an agent or human). It is additive: the
version-1 contract (`uvrn-probability-input-1` / `uvrn-probability-1`) stays valid, unchanged, and
reproducible through its own interface and vectors.

The words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used in the RFC 2119 sense.

---

## 1. Design law

1. **Additive only.** Nothing here changes `drvc3-delta-1`, `uvrn-master-1`, `drvc3-receipt-1`,
   `uvrn-receipt-4`, `uvrn-outcome-1`, or `uvrn-probability-1`. This spec adds two declared-field-list
   hashes — `uvrn-probability-question-1` (§3.2) and `uvrn-probability-2` (§4.2) — and wraps the
   record in an ordinary `uvrn-receipt-4` NetworkReceipt.
2. **The caller selects one mode.** There is no precedence, fallback, blending, or cross-mode read.
   Inputs for a mode other than the selected one MUST fail validation (§7.1).
3. **Refuse rather than guess.** Calculated modes refuse (§7.2) when the data do not support a number.
   A judgment MAY abstain. No placeholder probability is ever emitted.
4. **Malformed is not refused.** A structurally malformed request MUST throw a typed validation error
   (§7.1) and MUST NOT produce a receipt. Every structurally valid request — including abstention and
   `insufficient_basis` — MUST produce a receipted record.
5. **No clock, no randomness, no network, no model.** The evaluation instant is the explicit, cited
   `asOf`. An implementation MUST NOT read the system clock, a random source, the network, or run a
   model while computing.
6. **Probability is not a V-Score.** A probability MUST NOT be written to, labeled as, averaged with,
   or adjusted from a V-Score, agreement, drift, stance, signal, or any evidence-quality reading.
   Such readings are optional, supplied and stored by the host, and never block a forecast. An
   implementation MUST NOT import other UVRN packages to obtain them. A judgment MAY discuss them;
   when it does, that influence is recorded in its rationale or evidence (§5).
7. **Judgment is attributed opinion.** Acceptance validates structure and arithmetic, never accuracy
   or the truth of citations.

---

## 2. Input (`uvrn-probability-input-2`)

```
{
  specVersion: 'uvrn-probability-input-2',
  forecastId:  string,                        // caller-assigned, non-empty; §3.4
  mode:        'market' | 'baserate' | 'judgment',
  question:    Question,                      // §3.1
  asOf:        { at: ZonedTimestamp, source: Citation },
  producer:    { id: string, kind: 'agent' | 'human', model?: string },
  market?:     MarketInput,                   // required iff mode = 'market'   (§6.1)
  baserate?:   BaseRateInput,                 // required iff mode = 'baserate' (§6.2)
  judgment?:   JudgmentInput | { abstain: true, reason: string },   // iff mode = 'judgment' (§5)
  thresholds?: Partial<Thresholds>,           // market / baserate only (§8)
  revision?:   { previousProbabilityHash: 'sha256:<64 hex>', reason: string },
  profile?:    RuleProfile                    // tighten-only policy (§8.1)
}
```

- Every object in the input is **closed**: an undeclared member at any depth MUST fail with
  `unknown_field`. `Citation`, `ZonedTimestamp`, and `DateOrZoned` are as in `uvrn-probability-v1.md`
  §3.1–3.2; a citation additionally admits only `url`, `accessedAt`, `label`.
- **Strict calendar values.** Every `ZonedTimestamp`, `DateOrZoned`, and `YYYY-MM-DD` in a version-2
  input (including `asOf.at`, citation `accessedAt`, `quotedAt`, `resolvesAt`, `settlesAt`, case
  `resolvedAt` / `filedAt` / `statusAt`, `subject.filedAt`, `horizon.by`, `question.resolveBy`, and a
  binding's `resolveBy` / `declaredAt`) MUST name a real instant: month 01–12, a day that exists in that
  month (leap years per the Gregorian rule), hour 00–23, minute and second 00–59, **at most 3
  fractional-second digits** (milliseconds: `.9`, `.99`, `.999`), and offset hours 00–23 / minutes
  00–59. An impossible value (`2026-02-30`, `2026-02-29`, `T24:00`, `2026-04-31`, `+24:00`) or a
  sub-millisecond fraction (`.9999`, `.123456789`) MUST fail with `invalid_input` (`missing_citation`
  for a citation's `accessedAt`, `invalid_question` for `question.resolveBy`) and MUST NOT be rolled
  over into another date or silently truncated. The version-1 contract keeps its own parser unchanged.
- **Schema is not sufficient.** The input schema's date patterns check shape and ranges only; JSON
  Schema patterns cannot enforce days-in-month or leap years. `runForecast` enforces them, so a
  document that passes `uvrn-probability-input-2.schema.json` alone is not guaranteed to be accepted.
  `runForecast` is the only strict version-2 entry point: the lower-level `evaluateMarket` /
  `evaluateBaseRate` keep version-1 permissive parsing by design.
- Strings documented as non-empty MUST contain at least one non-whitespace character.
- `producer` attributes the estimate. The receipt signer (§4.3) separately identifies a signing key.
  `model` is caller-declared and not verified.
- A `timestamp` citation on `asOf` is provenance supplied by the caller, not proof of independent time
  anchoring.
- `revision` links a new record to a prior `probabilityHash` with a reason. It never mutates the prior
  record, and the implementation cannot prove the prior record exists.
- The JSON Schema is normative for structure. The rules the schema cannot express (judgment sum and
  precision, outcome-id uniqueness after normalization, range enclosure, declaration recomputation,
  deadline after `asOf`) are enforced as validation errors (§7.1).

---

## 3. Question identity and deadlines

### 3.1 Question

```
Question {
  text:               string,
  resolveBy:          'YYYY-MM-DD',          // valid calendar date; interpreted through 23:59:59.999Z UTC
  resolutionRule:     string,
  kind:               'binary' | 'categorical',
  outcomes:           Outcome[],             // ≥ 2
  partitionConfirmed: true                   // producer attests: mutually exclusive and exhaustive
}
Outcome { id: string, label: string, definition: string, outcomeDeclaration?: OutcomeDeclarationBinding }
```

- `asOf` MUST be before the end of the `resolveBy` day in UTC (`asOf < resolveBy 00:00Z + 1 day`).
- Binary questions MUST have exactly two outcomes with ids `yes` then `no`. Categorical questions MUST
  have ≥ 2 outcomes whose ids are unique after §3.2 normalization.
- `partitionConfirmed` MUST be `true`. Software checks structure only; semantic exclusivity and
  exhaustiveness are the producer's attestation.
- Market and base-rate modes support **binary questions only** in this version. A categorical question
  with `mode: 'market' | 'baserate'` MUST fail with `unsupported_mode_for_question`. Judgment supports
  both kinds.

### 3.2 `questionHash` (`uvrn-probability-question-1`)

`questionHash` identifies what will resolve. It is `sha256:` + hex SHA-256 of the `uvrn-jcs-1`
canonicalization of exactly:

```
{ specVersion: 'uvrn-probability-question-1', text, kind, resolveBy, resolutionRule,
  outcomes: [{ id, label, definition }] }   // outcomes in question order
```

- **Normalization (preimage only):** every string in the preimage is Unicode NFC-normalized, then
  trimmed of leading/trailing whitespace. No other whitespace, case, or punctuation change is applied.
  The recorded `question` (§4.1) is preserved exactly as supplied.
- The preimage EXCLUDES `partitionConfirmed`, `producer`, `asOf`, `forecastId`, probabilities, and
  outcome-declaration bindings. Wording is included: any edit, including a typo fix, produces a new
  `questionHash`, and a changed question starts a new series. The implementation never guesses whether
  an edit changes meaning.

### 3.3 Optional outcome-declaration bindings

`OutcomeDeclarationBinding` is closed:

```
{ specVersion: 'uvrn-outcome-1', entryId, predictedOutcome, outcomeMetric, resolveBy, declaredAt, outcomeHash }
```

The implementation MUST recompute `uvrn-outcome-1` (`uvrn-outcome-v1.md` §3, via the shared
canonical/hash primitives) over `{ specVersion, entryId, predictedOutcome, outcomeMetric, resolveBy,
declaredAt }` and fail with `outcome_declaration_mismatch` when it differs from `outcomeHash` or when
the binding's `resolveBy` differs from `question.resolveBy`. Resolution members (`outcomeStatus`, …)
are not accepted. Bindings are covered by `probabilityHash` but lie outside `questionHash`:
`questionHash` links to, and never reuses, `outcomeHash` (which includes declaration-specific
`entryId` and `declaredAt`). Hash checks establish integrity; semantic correspondence between a
question and a declaration remains the caller's confirmation.

### 3.4 `forecastId` and `probabilityHash`

- `forecastId` is caller-supplied and emitted unchanged. The implementation MUST NOT generate or
  derive it. Callers reuse it only for an identical retry and supply a new one for a revision. The
  same `forecastId` with a different `probabilityHash` is a conflict for the host to flag; a stateless
  implementation cannot detect it.
- `probabilityHash` (§4.2) identifies the complete recorded forecast, including `questionHash` and any
  declaration bindings.

### 3.5 Deadline semantics

- Market `resolvesAt` means the market's underlying **event cutoff**: the instant by which the event
  must occur for the market's YES to pay. It MUST fall on the same UTC calendar date as
  `question.resolveBy`, otherwise the forecast refuses with `deadline_mismatch`.
- Market `settlesAt` (optional) is the administrative settlement time. It is recorded, never matched.
  A market that settles the day after the deadline but whose event cutoff matches is accepted.
- A time-to-event base rate's `horizon.by` MUST fall on the same UTC date as `question.resolveBy`,
  otherwise `deadline_mismatch`. Matching is by UTC calendar date.
- **Horizon instant.** Consistent with §3.1 (a date-only `resolveBy` runs through 23:59:59.999Z), a
  date-only `horizon.by` is evaluated at the **end of that UTC day** (`YYYY-MM-DDT23:59:59.999Z`); a
  zoned `horizon.by` is evaluated at the instant given. The record states the instant used as
  `horizonInstantUtc`, and `timeToEvent.horizonDays` is measured to it. So a date-only deadline and the
  equivalent `…T23:59:59.999Z` horizon give the same probability for the same `questionHash`.
  Reference-case dates (`filedAt`, `statusAt`, `resolvedAt`) keep `uvrn-probability-v1.md` §3.2 semantics
  (a date means 00:00Z), so a day-granular event dated on the deadline counts. Version 1 is unchanged:
  its date-only horizon remains 00:00Z.
- **Event-cutoff instant.** By the same rule, a date-only market `resolvesAt` is read as the **end of
  that UTC day** (`YYYY-MM-DDT23:59:59.999Z`); a zoned `resolvesAt` is read at the instant given. That
  instant is the one used for `market_resolves_before_asof` and `timeToEventCutoffDays`, and the record
  states it as `eventCutoffInstantUtc`. So a date-only cutoff on `asOf`'s own UTC date, with `asOf`
  before the end of that day, is accepted and times identically to the explicit `…T23:59:59.999Z`
  cutoff. Deadline matching stays by UTC date (`eventCutoffUtcDate`). Version 1 is unchanged: its
  date-only `resolvesAt` remains 00:00Z.
- A proportion base rate has no horizon; nothing is matched and `deadlineMatched` is recorded as `null`.
  The caller asserts that the reference-class outcome window corresponds to the question.
- Semantic event equivalence (that the market's or class's event is the question's event) is the
  caller's responsibility.

---

## 4. Output, hash, receipt, verification

### 4.1 Output

```
{ specVersion: 'uvrn-probability-2', origin, forecastId, question, questionHash, asOf, producer,
  mode, status, basis, probabilities, unit, quantityKind, band, inputs, limitations, refusals,
  revision, profile?, probabilityHash, receipt }
```

| Field | Rule |
|---|---|
| `origin` | `model:@uvrn/probability@0.2.0` — the pinned compatibility origin of this contract's reference emitter. It does not track later package releases, so records and golden vectors stay reproducible; old records are never relabeled |
| `question` | as supplied; each outcome carries `outcomeDeclaration` (binding or `null`) |
| `asOf` | `asOf.at` normalized to UTC `YYYY-MM-DDTHH:mm:ss.sssZ` |
| `producer` | `{ id, kind, model }` with `model: null` when absent |
| `status` | `forecast` \| `insufficient_basis` |
| `basis` | `market-implied` \| `reference-class` \| `agent-judgment` on forecast; `null` otherwise |
| `probabilities` | ordered `{ outcomeId, p }[]` in question order; `null` on `insufficient_basis` |
| `unit`, `quantityKind` | always `"1"` and `"probability"` (UCUM unity; `uvrn-probability-v1.md` §5.5, `uvrn-typed-observation-v1.md`) |
| `band` | `null` or `{ outcomeId: 'yes', low, high, kind, confidence }` (§4.4) |
| `inputs` | `{ asOf, thresholds, market, baserate, judgment }`; the selected mode's record is non-null and unselected modes are `null`; `thresholds` is `null` in judgment mode and non-null otherwise (§4.1.1) |
| `limitations` | fixed applicable honesty notes plus the judgment basis label and producer-stated uncertainty |
| `refusals` | `{ code, scope, message }[]`; empty on forecast, non-empty on `insufficient_basis` |
| `revision` | supplied link or `null` |
| `profile` | present only when a rule profile was supplied: `{ specVersion, id, version, hash }` (§8.1); absent — not `null` — otherwise |

#### 4.1.1 Provenance records

Every `inputs` record is closed and defined in `uvrn-probability-result-2.schema.json`:

- **`inputs.market`** — `kind`, `venue`, `domain`, `priceLabel: 'market-implied'`, `biasCorrection:
  'none'`, `resolvesAt`, `resolvesAtMeaning: 'event-cutoff'`, `eventCutoffUtcDate`,
  `eventCutoffInstantUtc` (§3.5), `settlesAt` (or
  `null`), `deadlineMatched`, `timeToEventCutoffDays`, `targetOutcome`, `targetOutcomeId: 'yes'`,
  `source`, and `outcomes[]` (`label`, `quotedAt`, `ageHours`, `source`, plus the **submitted** price:
  sportsbook `odds`, or exchange `bid`, `ask`, `depthUsd`). The submitted price is recorded even when it
  is refused (`market_invalid_odds`), so two different refused prices yield different
  `probabilityHash` values. Computed `impliedP` / `mid` appear only for a valid price. The optional
  `sportsbook` (overround, de-vig arrays, parameters, method spread) or `exchange` (spread, depth,
  normalization sum) summary appears only when every price is valid. Non-finite prices cannot occur in a
  record: they are `invalid_input` validation errors (and are not representable in JSON).
- **`inputs.baserate`** — `role: 'baserate'`, `mode`, `referenceClass`, `minCases`, `casesDeclared`,
  `casesIncluded`, `cases[]`, `excluded[]`, `targetOutcomeId: 'yes'`, `horizonUtcDate`,
  `deadlineMatched`; a proportion record adds `proportion` (Jeffreys summary) with `horizonUtcDate` and
  `deadlineMatched` `null`; a time-to-event record adds `timeToEvent` (estimator summary, `interval`
  `'log-log'` or `null`) and `minAtRiskRequired` (§6.2).
- **`inputs.judgment`** — on a forecast, `basisLabel`, `evidence[]`, `assumptions[]`, `rationale`,
  `counterarguments[]` (≥ 1), `uncertainty`, `range` (or `null`); `assumption-only` requires empty
  evidence and ≥ 1 assumption, `cited-evidence-and-judgment` requires ≥ 1 evidence item. On
  `insufficient_basis` it is the abstention record `{ abstain: true, reason }`.

`basis`, band `kind`, and refusal `scope` follow the mode (market: `market-implied`,
`method-spread`/`bid-ask`, scope `market`; base rate: `reference-class`, `statistical`, `baserate`;
judgment: `agent-judgment`, `subjective`, `judgment`).

Calculated binary modes emit YES `p` (rounded, §4.5) and NO as its exact millionth complement
`(1 000 000 − round(p·1e6)) / 1e6`. There is no separate scalar `p` field and no typed-observation
`source` projection in version 2. Hosts that use a different unit string (for example `"prob"`) map
it themselves.

### 4.2 `uvrn-probability-2` — the probability hash

- **Encoding:** `prefixed` (`sha256:` + 64 lowercase hex). **Canonicalization:** `uvrn-jcs-1` via
  `@uvrn/receipt/canonical`.
- **Payload:** exactly this closed field list:

```
{ specVersion, origin, forecastId, question, questionHash, asOf, producer, mode, status, basis,
  probabilities, unit, quantityKind, band, inputs, limitations, refusals, revision }
```

All eighteen fields are REQUIRED; absent optional values are hashed as `null`. `probabilityHash` and
`receipt` are outside the list. Hash-covered additions require a new `specVersion`.

One **optional hashed member** is defined: `profile` (§8.1). When the record carries it, it is added
to the payload and hashed; when no profile was supplied it is omitted from both the record and the
payload (never hashed as `null`), so a record without a profile hashes exactly as before profiles
existed. A verifier includes `profile` whenever the member is present, so adding, removing, nulling,
or editing it invalidates `probabilityHash`.

### 4.3 Receipt

A `uvrn-receipt-4` NetworkReceipt built with `@uvrn/receipt` primitives:

```
kind: 'probability', source: '@uvrn/probability', action: 'probability.forecast', occurredAt: asOf,
claim: { id: claimIdFromText(text), text: 'Forecast for uvrn-probability-question-1 question <questionHash>' },
payload: { ...hashPayload, probabilityHash },
tags: ['probability', 'forecast', 'mode:<mode>', 'status:<status>'] (+ 'judgment:<basisLabel>'),
narrative: fixed template (no caller strings)
```

Signing is OPTIONAL (caller-supplied Ed25519 key and optional `signedAt`, `uvrn-signing-v1` §2).
Private key material MUST NOT appear in any output or message.

### 4.4 Bands

| `kind` | Produced by | `confidence` |
|---|---|---|
| `method-spread` | sportsbook: min/max of multiplicative, power, Shin for the target (v1 §4.2) | `null` |
| `bid-ask` | exchange: bid/ask (normalized for multi-outcome books) (v1 §4.3) | `null` |
| `statistical` | base rate: Jeffreys (v1 §4.4) or log-log Aalen-Johansen interval (§6.2) | `0.95` |
| `subjective` | judgment `range` (§5.2) | `null` |

Only statistical intervals carry a confidence level. A judgment without a range has `band: null`,
never a zero-width interval. Categorical forecasts have `band: null`.

### 4.5 Rounding

Every computed number in the output is rounded with `Math.round(x·1e6)/1e6` (negative zero → 0)
before canonicalization (`uvrn-probability-v1.md` §5.1). Accepted judgment values already have at most
six decimals and are preserved exactly.

### 4.6 Verification

Verification MUST dispatch strictly on `payload.specVersion`:

- `uvrn-probability-1`: the version-1 verifier (`uvrn-probability-v1.md` §5.4).
- `uvrn-probability-2`: recompute `probabilityHash` (§4.2), `questionHash` from the recorded question
  (§3.2), every declaration binding's `outcomeHash` (§3.3), and `verifyReceiptFull`.
- anything else: fail with `UNSUPPORTED_VERSION`.

`verified` requires every applicable recompute plus a valid producer signature. An unsigned record is
at most integrity-checked. Changing any hashed member — producer attribution, probabilities, question
definitions, assumptions, evidence, or declaration bindings — MUST invalidate the inner hash.

---

## 5. Judgment

### 5.1 Input

```
JudgmentInput {
  probabilities:    { outcomeId, p }[],             // exactly one per question outcome
  evidence?:        { id, statement, source: Citation }[],
  assumptions?:     { id, statement }[],            // explicitly speculative premises
  rationale:        string,
  counterarguments: string[],                       // ≥ 1
  uncertainty:      string,                         // gaps, sensitivities, what would change the view
  range?:           { low, high, rationale }        // binary only, for YES
}
Abstention { abstain: true, reason: string }
```

- At least one evidence item OR one assumption is REQUIRED; otherwise `judgment_basis_missing`.
  Evidence and assumption ids are unique across both lists. Citation structure is validated, never
  content. An implementation MUST NOT demand a citation that would have to be invented.
- Basis label, recorded in `inputs.judgment.basisLabel`, in `limitations`, and as a receipt tag:
  `assumption-only` when `evidence` is empty, else `cited-evidence-and-judgment`. The package and
  track-record do not separate assumption-only forecasts automatically; a host that wants to compare
  them later MUST preserve the label (or a linked metadata record).
- A judgment MAY discuss a market or base rate as an anchor, or UVRN readings; it remains judgment.

### 5.2 Allocation rules

1. Each `p` is a finite number in [0, 1] with at most six decimal places.
2. Converted to integer millionths `round(p·1e6)`, the allocation MUST sum to exactly 1 000 000.
3. Duplicate, unknown, or missing outcome ids fail. Values are NEVER normalized or adjusted.
4. Output order follows the question's outcome order, not the submitted order.
5. `range` is allowed only for binary questions; `0 ≤ low < high ≤ 1`, six-decimal precision, and it
   MUST enclose YES `p`. It is a subjective plausible range, never a confidence interval. Omit it when
   no defensible range exists.

All violations fail with typed validation errors (§7.1); none produce a receipt.

### 5.3 Abstention

`{ abstain: true, reason }` yields `status: 'insufficient_basis'`, `probabilities: null`, and refusal
`judgment_abstained` (scope `judgment`). It supplies no numeric allocation and is receipted.

---

## 6. Calculated modes (binary)

The market and base-rate mathematics of `uvrn-probability-v1.md` §4 are reused unchanged, with the
version-2 rules below. The target market outcome / base-rate target event is the question's YES.

### 6.1 Market

`MarketInput` is the version-1 market (`uvrn-probability-v1.md` §4.1–4.3) plus optional `settlesAt`,
with `resolvesAt` meaning the event cutoff (§3.5). Structural problems (missing citation, duplicate or
missing labels, too few outcomes, `targetOutcome` not listed) are validation errors. Price validity,
staleness, overround, spread, depth, and de-vig convergence remain refusals. Power de-vig is the
default; `priceLabel: 'market-implied'` and `biasCorrection: 'none'` are recorded. Thresholds for
quote freshness are not scaled with time-to-deadline. A date-only `resolvesAt` is read at the end of
its UTC day (§3.5) for `market_resolves_before_asof` and `timeToEventCutoffDays`. The record adds
`resolvesAtMeaning: 'event-cutoff'`, `eventCutoffUtcDate`, `eventCutoffInstantUtc`, `settlesAt`,
`deadlineMatched`, `timeToEventCutoffDays`, and `targetOutcomeId: 'yes'`.

### 6.2 Base rate

`BaseRateInput` is the version-1 proportion or time-to-event base rate (`uvrn-probability-v1.md`
§4.4–4.6). The declared-criteria gate (`baserate_below_min_cases`), Jeffreys interval with the
Brown-Cai-DasGupta boundary rule, and Aalen-Johansen competing-risks estimator with the log-log
interval are retained. Version 2 changes the time-to-event path:

1. **At-risk gate.** Let `n_a` = reference cases with `time > a` (still at risk just after the
   subject's elapsed time `a`). If `n_a = 0` or `S(a) = 0` → `baserate_no_risk_set_at_elapsed`
   (unchanged). Else if `n_a < minCases` → `baserate_below_min_at_risk`. This is a conservative
   policy, not proof of calibration.
2. **Follow-up.** `baserate_horizon_beyond_followup` is kept (v1 §4.5.2); it MAY be reported together
   with `baserate_below_min_at_risk`. When estimated survival reaches zero at the last observed time,
   the finite-tail estimate beyond it is permitted.
3. **No degenerate fallback.** When the log-log transform is undefined (`F ∈ {0, 1}` or `se = 0`), the
   forecast MUST refuse with `baserate_interval_unavailable`. The version-1 Jeffreys fallback (v1
   §4.5.3), which counts censored cases as completed binomial trials, MUST NOT be used.
4. The record adds `targetOutcomeId: 'yes'`, `horizonUtcDate`, `horizonInstantUtc` (§3.5),
   `deadlineMatched`, and `minAtRiskRequired`; `timeToEvent.interval` is `'log-log'` or `null`.
5. **Horizon instant (§3.5).** A date-only `horizon.by` is evaluated at 23:59:59.999Z of that UTC day.
   Worked case (vectors `v2-baserate-deadline-date-only` / `-zoned`): `asOf` = subject filing =
   2026-09-26T00:00:00Z, `resolveBy` 2026-09-27, eight cases filed 2025-01-01T00:00:00Z with durations
   (days) approved 0.5, 0.5, 1.5, 1.5; denied 1.75, 1.75; censored 3, 3; `minCases` 8. The horizon is
   ≈ 2 days after filing, so four approvals fall inside it: YES = 4/8 = **0.5** for both `horizon.by:
   '2026-09-27'` and `'2026-09-27T23:59:59.999Z'`. (Evaluated at 00:00Z, as version 1 does, only the two
   0.5-day approvals count, giving 0.25.)

**Worked boundary (hand-checked; vectors `v2-baserate-at-risk-boundary-*`).** Cases (days from filing):
100 approved, 150 denied, 200 approved, 200 withdrawn, 250 pending, 300 approved, 350 denied,
400 approved, 450 pending, 500 approved; `minCases = 6`. The fixture's date-only `horizon.by` is 420
days after filing at 00:00Z, but version 2 reads it at the end of that UTC day (§3.5), so the recorded
`timeToEvent.horizonDays` is **421** (1 ms short, rounded to six decimals). No case time lies in
(420, 421], so (a, 421] contains exactly the events of (a, 420] and the estimate below is unchanged.
- `a ≈ 220.79`: at risk after `a` = {250, 300, 350, 400, 450, 500} = 6 = `minCases` → accepted.
  Rows in (a, 421]: t=300 n=5 d1=1 → F=0.2, S=0.8; t=350 n=4 d2=1 → S=0.6; t=400 n=3 d1=1 →
  F = 0.2 + 0.6/3 = **0.4**.
- `a ≈ 260.79`: at risk = {300, 350, 400, 450, 500} = 5 < 6 → `baserate_below_min_at_risk`
  (horizonDays also 421).

The other date-only time-to-event vectors follow the same rule: `v2-baserate-competing` records
`horizonDays` **451** (fixture horizon 450; its latest in-window time is the pending case at 450, and
nothing lies in (450, 451]), and `v2-baserate-interval-unavailable` records **301** (fixture horizon
300; every case time is 400). Their estimates and refusals are the same as at the unadjusted horizon.

**Assumptions to disclose.** Comparable reference cases; a defensible observation origin; censoring
that does not systematically conceal the target outcome. Events with different definitions ("permit
granted" vs "built") are different questions. A filing-based model cannot evaluate an unfiled subject
by inventing a filing date.

---

## 7. Validation errors and refusals

### 7.1 Validation errors (no receipt)

Typed error `{ code, path, message }`; messages name the member path and the rule and MUST NOT echo
input values or key material. Closed code list:

| Code | Meaning |
|---|---|
| `unsupported_version` | `specVersion` is not `uvrn-probability-input-2` (or a binding is not `uvrn-outcome-1`) |
| `unknown_field` | an undeclared member at any depth |
| `invalid_input` | wrong type, missing required member, bad date/timestamp, structural market/base-rate fault |
| `missing_citation` | a citation is present but malformed |
| `mixed_mode_input` | input supplied for a mode other than `mode` |
| `unsupported_mode_for_question` | market or base rate on a categorical question |
| `invalid_question` | question structure, binary ids, duplicate ids, partition attestation, deadline not after `asOf` |
| `outcome_declaration_mismatch` | binding hash does not recompute or its `resolveBy` differs |
| `invalid_threshold` | bad threshold value, non-positive-integer `minCases`, or thresholds in judgment mode |
| `invalid_revision` | malformed `previousProbabilityHash` or empty `reason` |
| `invalid_judgment` | missing/empty rationale, counterargument, uncertainty, evidence/assumption fields, duplicate ids, malformed abstention |
| `judgment_basis_missing` | neither evidence nor labeled assumptions |
| `invalid_distribution` | NaN, out of range, > 6 decimals, duplicate/unknown/missing outcome, sum ≠ 1 000 000 millionths |
| `invalid_range` | range on a categorical question, not enclosing YES, zero-width, out of [0, 1], > 6 decimals |
| `invalid_profile` | malformed rule profile, or a profile threshold looser than the default (§8.1) |
| `profile_violation` | the request uses a mode the profile does not allow, or misses a profile requirement (§8.1) |

A profile whose `specVersion` is not `uvrn-probability-profile-1` fails with `unsupported_version`;
an undeclared profile member fails with `unknown_field`.

### 7.2 Refusal codes (closed list for v2)

Shape `{ code, scope: 'market' | 'baserate' | 'judgment', message }`.

| Code | Scope | Meaning |
|---|---|---|
| `market_invalid_odds` | market | Odds/bid/ask invalid or implied probability not in (0,1) |
| `market_quote_after_asof` | market | A quote is timestamped after `asOf` |
| `market_quote_stale` | market | A quote is older than `maxQuoteStalenessMs` |
| `market_resolves_before_asof` | market | The event cutoff is at or before `asOf` |
| `market_overround_out_of_range` | market | Overround < 0 or > `maxSportsbookOverround` |
| `market_spread_too_wide` | market | Target spread > `maxExchangeSpread` |
| `market_depth_too_thin` | market | Target depth < `minExchangeDepthUsd` |
| `devig_nonconvergence` | market | Power or Shin did not bracket or converge |
| `baserate_unknown_criterion` | baserate | A case cites an undeclared criterion |
| `baserate_invalid_case` | baserate | Duplicate case id or `statusAt` before `filedAt` |
| `baserate_event_after_asof` | baserate | A case outcome/status is dated after `asOf` |
| `baserate_below_min_cases` | baserate | Fewer than `minCases` cases pass the gate |
| `baserate_no_risk_set_at_elapsed` | baserate | No case at risk at the elapsed time |
| `baserate_horizon_not_after_elapsed` | baserate | Horizon not after `asOf` |
| `baserate_horizon_beyond_followup` | baserate | Horizon beyond follow-up while cases were unresolved |
| `baserate_nonconvergence` | baserate | Incomplete-beta evaluation did not converge |
| `baserate_below_min_at_risk` | baserate | Fewer than `minCases` cases at risk just after the elapsed time (§6.2) |
| `baserate_interval_unavailable` | baserate | Log-log interval undefined; no substitute interval (§6.2) |
| `deadline_mismatch` | market / baserate | Event cutoff or horizon on a different UTC date than `resolveBy` (§3.5) |
| `judgment_abstained` | judgment | The producer abstained (§5.3) |

`invalid_input`, `missing_citation`, `no_candidate`, and `market_target_not_found` are not version-2
refusals: the first two and the last are validation errors, and there is no candidate selection.

---

## 8. Thresholds

The version-1 thresholds (`uvrn-probability-v1.md` §7) are reused unchanged, remain **PROVISIONAL**,
and are recorded in `inputs.thresholds` (`provisional: true`, `values`, `overridden`). Version 2
additionally requires `minCases` to be a positive integer (≥ 1); other thresholds are finite and
non-negative. `minCases` gates both the included reference class and the at-risk count (§6.2).
Thresholds are not accepted in judgment mode.

### 8.1 Rule profiles (`uvrn-probability-profile-1`)

A rule profile is optional, caller-supplied **data** that can only make a request stricter. It has no
callbacks, expressions, or code, and the package does not fetch, store, or authenticate it.

```
RuleProfile {
  specVersion:   'uvrn-probability-profile-1',
  id:            string,                                   // non-empty
  version:       string,                                   // non-empty
  allowedModes?: ('market' | 'baserate' | 'judgment')[],   // ≥ 1, unique; omitted = all three
  thresholds?:   Partial<Thresholds>,                      // each at least as strict as the default
  require?:      { zonedTimestamps?: boolean, judgmentRange?: boolean, citedEvidence?: boolean }
}
```

- **Closed and strict.** Every member is validated; an undeclared member at any depth fails with
  `unknown_field`, a wrong type with `invalid_profile`.
- **Tighten-only.** Each threshold has a direction: `minCases` and `minExchangeDepthUsd` are floors (a
  profile may raise them); `maxQuoteStalenessMs`, `maxExchangeSpread`, and `maxSportsbookOverround` are
  ceilings (a profile may lower them). A profile value looser than the §8 default fails with
  `invalid_profile`; it is never clamped or ignored. The effective value is the stricter of the
  profile's limit and the caller's `thresholds` value (or the default when the caller gives none), so
  a caller override can never undo a profile limit. Keys the profile does not name behave exactly as
  in §8. `inputs.thresholds.values` records the effective values and `overridden` lists every key whose
  effective value differs from the default. Profile thresholds are ignored in judgment mode, where
  `inputs.thresholds` stays `null`.
- **Modes.** The permitted set is the intersection of the three modes with `allowedModes`. A request
  whose `mode` is outside it fails with `profile_violation` (path `mode`) and produces no receipt: it
  is outside the caller's own declared policy, not a data shortfall, so it is not a refusal.
- **Requirements** (`true` enables, `false` or absent is a no-op):
  - `zonedTimestamps` — market `resolvesAt` / `settlesAt` and base-rate case, subject, and horizon
    dates MUST be zoned timestamps; a date-only value fails with `profile_violation`.
    `question.resolveBy` is always a date and is not affected.
  - `judgmentRange` — a binary judgment allocation MUST include `range`; categorical judgments and
    abstentions are unaffected.
  - `citedEvidence` — a judgment allocation MUST include at least one evidence item (no
    `assumption-only`); abstentions are unaffected.
- **Record.** The result carries `profile: { specVersion, id, version, hash }`, where `hash` is
  `sha256:` + hex SHA-256 of the `uvrn-jcs-1` canonicalization of the supplied profile (via the shared
  canonical/hash primitives). It is covered by `probabilityHash` (§4.2) and outside `questionHash`. A
  fixed limitation notes that a profile was applied and that its authorship is not verified.
- **No profile** leaves behavior, output, and every hash exactly as without this section.

---

## 9. Golden vectors

`SPEC/vectors/probability-v2.json` holds synthetic fixtures (example.org citations, invented
questions — not research, never real claims). Each case gives the input, optional signer (the SPEC
test key from `network-receipt.json`), and expected `status`, `basis`, `probabilities`, `band`,
refusal codes, `questionHash`, `probabilityHash`, `receiptHash`, signature (when signed), and
`canonicalResultSha256` = SHA-256 of JCS of the entire result. Required coverage: sportsbook
(method-spread), exchange with next-day settlement (bid-ask), event-cutoff mismatch, proportion
(statistical), competing events, the at-risk boundary pair, interval unavailable, the date-only /
zoned end-of-day horizon pair (§3.5), the date-only / zoned same-day market event-cutoff pair
(§3.5), binary judgment
0.71/0.29 with range, categorical judgment 0.60/0.30/0.10, assumption-only, abstention, and a signed
judgment with a declaration binding and revision link, a profile that tightens `minCases` into a
refusal, and a judgment that satisfies a profile. A `validationErrors` section pins requests that MUST
throw `{ code, path }` without a receipt: a mode the profile disallows, an unknown profile member, a
loosening profile threshold, and an unmet profile requirement. Unit vectors pin NFC question hashing
and the `uvrn-outcome-1` recompute. `SPEC/vectors/probability-v1.json` is unchanged.

---

## 10. Determinism and platform

As `uvrn-probability-v1.md` §9: same input and same signer MUST produce byte-identical canonical
output; the reference platform is Node.js LTS on V8, and the golden vectors are the conformance
oracle elsewhere.

---

## 11. Honest vocabulary and limits

| Term | May be used when |
|---|---|
| **integrity-checked** | `uvrn-probability-2`, `questionHash`, declaration hashes, and `receiptHash` recompute |
| **verified** | integrity-checked AND the producer signature verifies (`uvrn-signing-v1`) |
| **market-implied** | `basis = market-implied`; never "calibrated" or "true probability" |
| **base rate** | `basis = reference-class` over a declared, cited reference class |
| **judgment** | `basis = agent-judgment`; an attributed opinion, never presented as a market quote or statistic |
| **calibrated** | reserved for a resolved track record showing it (not produced by this spec) |

Limits that copy and docs MUST state:
- A receipt proves integrity and which key signed. It does **not** prove accuracy, the truth of cited
  sources, or that the forecast existed before the outcome.
- Package arithmetic is reproducible; independent producers may judge the same research differently.
- A clean record requires the host to persist **every** output, including abstentions and refusals, and
  to log validation errors separately. The package is stateless and logs nothing.

---

## 12. Hosts and track records (informative)

No import in either direction. A host MAY log binary YES `p` or a complete categorical distribution
into the existing track-record contract (`uvrn-probability-v1.md` §11), logging refusals too, and MAY
keep research features and optional UVRN readings in a sidecar keyed by `forecastId` /
`probabilityHash`. Binary and multi-class Brier scores stay separate. Consuming `questionHash`,
`forecastId`, or `probabilityHash` in track-record is future work and not required by this spec.

---

## 13. Out of scope (v2)

Market-derived multi-outcome distributions, multi-outcome base rates, blending, automatic adjustment
from UVRN readings, bias correction, calibration, learned indicator weights, external timestamp
anchoring, model execution inside the package, and any real-world vectors.
