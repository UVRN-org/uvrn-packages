# UVRN Outcome Specification v1 (`uvrn-outcome-v1`)

**Status:** Normative · **Date:** 2026-07-07 · **Generation:** v4 / WS-LAUNCH-001
**Companion specs:** `uvrn-receipt-v1.md` (canonicalization, hash-encoding law) · `uvrn-measurement-v1.md`
**Reference implementation:** `uvrn-home` `scripts/research-protocol/adapter.mjs` (site-side, via `@uvrn/receipt` primitives)

This document defines the **outcome spine**: how a UVRN run declares a checkable prediction at
run time, and how that prediction is later resolved — without touching any existing receipt
shape or hash contract. It exists so the network can accumulate a receipt-backed track record of
*which disagreements led which outcomes*. A prediction that can be silently rewritten after the
fact is worthless; this spec makes the declaration immutable and the resolution append-only.

The words MUST, MUST NOT, SHOULD, and MAY are used in the RFC 2119 sense.

---

## 1. Design law (inherited, restated)

1. **Additive only.** Every field defined here is a new, optional member of the log entry (or of
   a future envelope). No field defined here enters any existing hash field list —
   `drvc3-delta-1`, `uvrn-master-1`, `drvc3-receipt-1`, and `uvrn-receipt-4` are unchanged and
   remain byte-for-byte verifiable.
2. **Own declared-field-list hash.** The outcome *declaration* gets its own hash
   (`uvrn-outcome-1`, §3) over a closed, declared field list — the same additive-evolution rule
   as `uvrn-receipt-v1.md` §2.
3. **Declaration is immutable; resolution is append-only.** The fields covered by
   `uvrn-outcome-1` MUST NOT change after the run is written. Resolution fields (§2.2) are
   outside the hash and are written exactly once, later, by the outcome-resolve routine
   (WS-LAUNCH-006).
4. **Old entries untouched.** Entries produced before this spec simply lack the blocks. A
   consumer MUST treat a missing `outcome` block as "no prediction was declared", never as an
   error.

---

## 2. The blocks

Both blocks are optional top-level members of a log entry (today: an element of
`src/data/expanse-log.json` in `uvrn-home`; tomorrow: any UVRN run record, including signal
cards).

### 2.1 `outcome` — the prediction declaration

```
outcome {
  specVersion:      'uvrn-outcome-1'                    // required
  predictedOutcome: string                              // required; plain-language prediction
  outcomeMetric:    string                              // required; what number/observable will move
  resolveBy:        string                              // required; ISO 8601 date (YYYY-MM-DD)
  declaredAt:       string                              // required; ISO 8601 UTC timestamp of declaration
  outcomeHash:      string                              // required; 'sha256:<64 hex>' per §3

  // ── resolution fields — NOT hashed, absent until resolved (§2.2) ──
  outcomeStatus:     'pending' | 'landed' | 'missed' | 'unresolvable'   // required; 'pending' at declaration
  outcomeResolvedAt?: string                            // ISO 8601 UTC; set once at resolution
  outcomeEvidence?:  OutcomeEvidence[]                  // set once at resolution
}

OutcomeEvidence {
  url:    string        // where the resolution evidence lives
  label:  string        // source name
  note?:  string        // ≤500 chars; what this evidence shows
}
```

Validation rules:

1. `predictedOutcome` and `outcomeMetric` MUST be non-empty strings. The prediction MUST be
   falsifiable — written so that a later reader can decide landed/missed from evidence.
2. `resolveBy` MUST be a valid ISO 8601 calendar date. Producers SHOULD choose the nearest date
   by which the prediction is checkable, not a far-future hedge.
3. `outcomeStatus` MUST be `'pending'` when the entry is first written. Producers MUST NOT write
   any of `outcomeResolvedAt` / `outcomeEvidence` at declaration time.
4. Resolution (WS-LAUNCH-006) sets `outcomeStatus` to exactly one of
   `'landed' | 'missed' | 'unresolvable'`, sets `outcomeResolvedAt`, and attaches ≥1
   `outcomeEvidence` entry (`'unresolvable'` MAY carry zero evidence but SHOULD carry a note
   explaining why). A resolved status MUST NOT be changed again.
5. Consumers MUST ignore unknown members of the block (forward compatibility).

### 2.2 Resolution semantics

| Status | Meaning |
|---|---|
| `pending` | Declared, `resolveBy` not yet passed or not yet checked |
| `landed` | The predicted movement happened, per evidence |
| `missed` | The predicted movement did not happen, per evidence |
| `unresolvable` | The metric cannot be observed (source vanished, metric redefined, event cancelled) |

`missed` and `unresolvable` are honest results, not failures. The scoreboard (WS-LAUNCH-006)
counts: predictions resolved · hit rate (`landed / (landed + missed)`) · disagreement-led ratio.

### 2.3 `disagreement` — where the sources split

```
disagreement {
  specVersion:          'uvrn-outcome-1'   // required (shares this spec's version)
  disagreementObserved: string             // required; where sources split, plain language
  disagreementScore:    number             // required; 0–1; reuse of the run's spread measure
  leadIndicatorNote?:   string             // what this divergence may precede
}
```

Validation rules:

1. `disagreementScore` MUST be the run's existing spread measure, reused — for Delta-Engine runs
   this is `deltaFinal` (already 0-relative; producers MUST clamp to [0, 1] for scores above 1).
   Do not invent a second disagreement metric.
2. `disagreementObserved` MUST be non-empty. When the author supplies no text, producers SHOULD
   derive it mechanically from the extreme sources (e.g. "`<label A>` at 96 vs `<label B>` at 82
   on prominence") — a mechanical truth beats an absent field.
3. `leadIndicatorNote` is the author's hypothesis and MAY be omitted. It is prose, not a claim of
   fact.
4. The block is not hashed by `uvrn-outcome-1` (it describes the run's evidence, which is already
   covered by the run's receipts). It MUST be written at run time and never edited.

---

## 3. `uvrn-outcome-1` — the declaration hash

- **Encoding:** `prefixed` (`sha256:` + 64 lowercase hex), per `uvrn-receipt-v1.md` §1.
- **Canonicalization:** `uvrn-jcs-1` (RFC 8785), via `@uvrn/receipt`'s `canonicalize()`.
- **Payload:** exactly this object, canonicalized — the declared field list, closed:

```
{
  specVersion:      'uvrn-outcome-1',
  entryId:          string,   // the run/entry id the prediction belongs to (e.g. 'run-141')
  predictedOutcome: string,
  outcomeMetric:    string,
  resolveBy:        string,
  declaredAt:       string
}
```

- **Unknown-field rule (normative):** the hash covers exactly the list above. `outcomeStatus`,
  `outcomeResolvedAt`, `outcomeEvidence`, the `disagreement` block, and any member added by a
  future minor revision are NOT hashed and MUST be ignored by hash verifiers. Hash-covered
  additions require a new `specVersion`.
- `entryId` binds the declaration to its run so a hash cannot be replayed onto a different entry.
- A verifier recomputes the hash from the stored block members + the entry's `id` and compares to
  `outcomeHash`. Mismatch means the declaration was edited after the fact — the exact thing this
  spec exists to make detectable.

---

## 4. Relationship to existing receipts

- The run's DeltaReceipt / MasterReceipt / NetworkReceipt are produced exactly as before; this
  spec adds nothing to their payloads and changes no `receiptHash`.
- The outcome declaration is site-of-record in the log entry today. When `@uvrn/outcomes` ships
  (WS-LAUNCH-009), the package becomes the reference implementation of §3 and MAY additionally
  emit an outcome NetworkReceipt (`kind` to be assigned then) at declaration and at resolution —
  both as new receipts, never as mutations.
- Resolution receipts (WS-LAUNCH-006) SHOULD link back to the run's `networkReceiptHash` via the
  `links[]` mechanism of `uvrn-receipt-v1.md` §3 (`rel: 'responds-to'`).

---

## 5. Honest-vocabulary requirements

| Term | May be used when |
|---|---|
| **declared** | the outcome block exists with a recomputable `outcomeHash` |
| **resolved** | `outcomeStatus` ∈ {landed, missed, unresolvable} with `outcomeResolvedAt` set |
| **track record** | reserved for aggregates over *resolved* predictions only — pending predictions are never counted as wins |

Copy that presents pending predictions as results violates this spec.

---

## 6. Worked example

Declaration (written at run time by the adapter):

```json
{
  "outcome": {
    "specVersion": "uvrn-outcome-1",
    "predictedOutcome": "US retail vacancy trackers will converge below 5% divergence by Q4 2026 as CoStar revises methodology",
    "outcomeMetric": "spread between CoStar and Cushman & Wakefield national retail vacancy rates",
    "resolveBy": "2026-12-31",
    "declaredAt": "2026-07-07T21:14:09.000Z",
    "outcomeStatus": "pending",
    "outcomeHash": "sha256:…"
  },
  "disagreement": {
    "specVersion": "uvrn-outcome-1",
    "disagreementObserved": "CoStar reports 4.1% national retail vacancy while Cushman & Wakefield reports 5.8% for the same quarter",
    "disagreementScore": 0.3434,
    "leadIndicatorNote": "Methodology gaps this wide have historically preceded a data-provider revision within two quarters"
  }
}
```

Resolution (appended later by outcome-resolve; declaration members untouched):

```json
{
  "outcomeStatus": "landed",
  "outcomeResolvedAt": "2027-01-04T18:00:00.000Z",
  "outcomeEvidence": [
    { "url": "https://…", "label": "CoStar methodology note", "note": "Revision published 2026-11; spread now 0.4pp" }
  ]
}
```
