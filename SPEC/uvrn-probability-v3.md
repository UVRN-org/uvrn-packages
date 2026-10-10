# UVRN Probability Specification v3 (`uvrn-probability-v3`)

**Status:** Normative (draft, pre-publish) · **Date:** 2026-09-28 · **Generation:** v2.1
**Base spec:** `uvrn-probability-v2.md`. Every v2 rule applies to version 3 unless this document says otherwise.
**Companion specs:** `uvrn-probability-v1.md` · `uvrn-outcome-v1.md` · `uvrn-receipt-v1.md` · `uvrn-signing-v1.md`
**Reference implementation:** `@uvrn/probability` 0.3.0 (this monorepo; not published)
**Schemas:** `SPEC/schemas/uvrn-probability-input-3.schema.json`, `SPEC/schemas/uvrn-probability-result-3.schema.json`
**Golden vectors:** `SPEC/vectors/probability-v3.json`

Version 3 adds one thing to version 2: a question's deadline day can be anchored to a **caller-supplied
fixed UTC offset**. Version 2 reads `question.resolveBy` as a UTC day, so an event whose deadline is
"the evening of 2026-10-31, Eastern" (which is 2026-11-01 in UTC) cannot be expressed. Version 3 lets
the question say `resolveBy: "2026-10-31"`, `resolveByOffset: "-04:00"`.

It is additive. `uvrn-probability-1` and `uvrn-probability-2` are unchanged and stay reproducible
through their own vectors; a version-2 request still produces exactly a version-2 record. Time zones
with daylight-saving rules (IANA names) are **not** part of this version (§10).

The words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used in the RFC 2119 sense.

---

## 1. Design law (additions to v2 §1)

1. **Additive only.** This spec adds two declared hashes — `uvrn-probability-question-2` (§4) and
   `uvrn-probability-3` (§5) — and changes nothing in any existing contract.
2. **A fixed offset, never a time zone.** The deadline day is read at exactly the supplied offset. No
   time-zone database or daylight-saving rule is consulted, so the result does not depend on the
   runtime's time-zone data. That the offset is correct for the date is the caller's attestation, and
   every record says so (§5.4).
3. **One entry point.** `runForecast` dispatches on the request's `specVersion`: `uvrn-probability-input-2`
   runs version 2, `uvrn-probability-input-3` runs version 3. There is no fallback between them.

---

## 2. Input (`uvrn-probability-input-3`)

Identical to `uvrn-probability-input-2` (v2 §2) except:

- `specVersion` MUST be `"uvrn-probability-input-3"`.
- `question.resolveByOffset` is **REQUIRED** (§3.1). It is closed-member data like every other
  question member.

Unknown versions fail with `unsupported_version` at `specVersion` (v2 §7.1).

---

## 3. Deadline semantics

### 3.1 The offset

`question.resolveByOffset` is a string `±hh:mm`:

- `hh` and `mm` are two ASCII digits; `mm` is `00`–`59`.
- The **combined** signed value MUST lie in **−12:00 … +14:00** (−720 … +840 minutes). So `-12:00`
  and `+14:00` are accepted, while `-12:01`, `-12:30`, `+14:01`, and `+14:30` are rejected.
- `-00:00` MUST be rejected. UTC is written `+00:00`.

Errors (§7):
- a **missing** `resolveByOffset` is a missing required member: `invalid_input` at
  `question.resolveByOffset`, exactly as v2 treats every missing required member;
- a **present but invalid** value: `invalid_question` at `question.resolveByOffset`.

### 3.2 The local deadline day and `inputs.deadline`

With offset `o` minutes, the deadline day is the half-open interval

```
startMs        = Date.UTC(resolveBy 00:00:00) − o·60 000      // local 00:00 of resolveBy
endExclusiveMs = startMs + 86 400 000                          // the next local 00:00
```

- **Year range.** Both bounds are recorded as UTC instants and MUST have a 4-digit year:
  `startMs ≥ 0000-01-01T00:00:00.000Z` and `endExclusiveMs ≤ 9999-12-31T23:59:59.999Z`. Otherwise the
  request fails with `invalid_question` at `question.resolveBy` ("the local deadline day must lie
  within years 0000–9999"). An exclusive end of exactly `10000-01-01T00:00:00.000Z` is rejected, so
  `9999-12-31` is rejected at `+00:00` and every negative offset. This check runs before any bound is
  rendered.
- **`asOf`.** `asOf` MUST be before `endExclusiveMs`, otherwise `invalid_question` at
  `question.resolveBy`. This is the v2 §3.1 rule with the local bound in place of the UTC bound, and
  it applies in every mode (market, base rate, judgment, abstention).
- **Record.** Every version-3 record carries the hashed member

```
inputs.deadline = { resolveBy, offset, startInstantUtc, endInstantUtcExclusive }
```

  with `offset` as supplied and both instants as `YYYY-MM-DDTHH:mm:ss.sssZ`.

### 3.3 Matching

A market event cutoff (`resolvesAt`, v2 §3.5) or a time-to-event horizon (`horizon.by`) **matches**
the deadline when its instant `t` satisfies

```
startMs ≤ t < endExclusiveMs
```

Otherwise the forecast refuses with `deadline_mismatch` (v2 §7.2).

**Read-instant range.** Before any evaluation or rendering, the instant a market `resolvesAt` or a
time-to-event `horizon.by` is read as (§3.4) MUST lie within UTC years 0000–9999; otherwise the
request fails with `invalid_input` at `market.resolvesAt` / `baserate.horizon.by` and produces no
receipt. So no version-3 record — including a refusal — renders a cutoff or horizon read instant with
an extended `±YYYYYY` year. This range covers only those read instants (and §3.2 covers the deadline
bounds); it does not bound other recorded instants such as `asOf`.

The refusal message names the local date and offset:

- market: `the market's event cutoff falls on <local date> at UTC offset <offset>; the question deadline is <resolveBy> at <offset>`
- base rate: `the base-rate horizon falls on <local date> at UTC offset <offset>; the question deadline is <resolveBy> at <offset>`

Matching is interval membership, not date-string comparison.

Records keep the version-2 UTC diagnostic fields and add the local date:

| Record | v2 fields kept | v3 addition |
|---|---|---|
| market | `eventCutoffUtcDate`, `eventCutoffInstantUtc`, `deadlineMatched` | `eventCutoffDeadlineDate`: calendar date of the cutoff instant at the offset |
| time-to-event | `horizonUtcDate`, `horizonInstantUtc`, `deadlineMatched` | `horizonDeadlineDate`: calendar date of the horizon instant at the offset |
| proportion | `horizonUtcDate: null`, `deadlineMatched: null` | `horizonDeadlineDate: null` |

### 3.4 Date-only reads

- A date-only market `resolvesAt` and a date-only `horizon.by` are read at **end − 1 ms of their own
  date at the question's offset** (local `23:59:59.999`). A zoned value is used as given. So a
  date-only value and the explicit `…T23:59:59.999±hh:mm` give the same instant and probability.
- Reference-case dates (`filedAt`, `statusAt`, `resolvedAt`) and `subject.filedAt` keep their
  `uvrn-probability-v1.md` §3.2 meaning: **a date means 00:00Z**.
- **One record can therefore mix two readings:** a date-only horizon read at the local end of day
  alongside date-only case dates read at 00:00Z. Vector `v3-baserate-mixed-date-reading` shows this.
- Version 1 (date-only = 00:00Z) and version 2 (date-only = UTC end − 1 ms) are unchanged.

---

## 4. Question identity (`uvrn-probability-question-2`)

A version-3 `questionHash` is `sha256:` + hex SHA-256 of the `uvrn-jcs-1` canonicalization of exactly:

```
{ specVersion: 'uvrn-probability-question-2', text, kind, resolveBy, resolutionRule,
  outcomes: [{ id, label, definition }], resolveByOffset }
```

That is the `uvrn-probability-question-1` preimage (v2 §3.2) with the new `specVersion` and
`resolveByOffset` added, normalized the same way (Unicode NFC, then trim). A version-2 question never
carries `resolveByOffset` (the v2 validator rejects it as an unknown member), so its identity is
always `-question-1`. The same question text at different offsets, or at `+00:00` versus version 2,
has a different `questionHash`.

---

## 5. Output and hash (`uvrn-probability-3`)

### 5.1 Record

As v2 §4.1, with:

- `specVersion: 'uvrn-probability-3'`;
- `origin: 'model:@uvrn/probability@0.3.0'` — the pinned compatibility origin of this contract's
  reference emitter. It does not track later package releases (the v2 origin is likewise pinned at
  `0.2.0`);
- `question` as supplied, including `resolveByOffset`;
- `questionHash` per §4;
- `inputs.deadline` per §3.2, and the record fields per §3.3.

### 5.2 Hash

The **top-level** declared field list is exactly v2 §4.2's eighteen fields, in the same order, with
`profile` as the same optional hashed member. The hashed `inputs` object gains the required
`deadline` member. `specVersion` distinguishes the two contracts, so no version-2 hash can collide
with a version-3 hash.

### 5.3 Receipt

As v2 §4.3, except the claim text names the version-3 identity:

```
claim.text = 'Forecast for uvrn-probability-question-2 question <questionHash>'
```

Version-2 receipts keep `'Forecast for uvrn-probability-question-1 question <questionHash>'`.

### 5.4 Limitations

Version-3 records carry one additional fixed limitation, byte for byte:

> Deadline day read at the caller-supplied fixed UTC offset (question.resolveByOffset); that the offset is correct for the date is the caller's attestation. No time-zone or daylight-saving rules are applied.

Order: the three always-present notes (receipt, no readings, partition), then the profile note when a
profile applies, then **this note**, then the mode notes as in version 2.

---

## 6. Verification

Verification dispatches strictly on `payload.specVersion` (v2 §4.6):

- `uvrn-probability-1` and `uvrn-probability-2`: unchanged.
- `uvrn-probability-3`: recompute `probabilityHash` (§5.2), `questionHash` under
  `uvrn-probability-question-2` (§4), every declaration binding's `outcomeHash`, **and
  `inputs.deadline`**, and run `verifyReceiptFull`. The recorded question MUST carry
  `resolveByOffset`. The deadline check (`deadlineOk`) recomputes the §3.2 record from the recorded
  `question.resolveBy` and `question.resolveByOffset` and requires `inputs.deadline` to have exactly
  the four members with exactly those values; otherwise it fails with `DEADLINE_RECORD_FAILED`.
- A `uvrn-probability-2` payload whose question carries `resolveByOffset` MUST fail the question check,
  and one that carries `inputs.deadline` MUST fail the deadline check. Version 1 reports
  `deadlineOk: null`.
- Anything else fails with `UNSUPPORTED_VERSION`. A verifier that predates version 3 therefore reports
  a version-3 record as unsupported; it never passes one.

**What verification proves.** Receipt verification proves the integrity (and, when signed, the signer)
of the record, and that the recorded deadline day is the one the recorded question defines (the §3.2
arithmetic is replayed). It does **not** re-run matching, read-instant evaluation, or the forecast
math, and it says nothing about whether the offset was right for the date (the caller's attestation,
§5.4). Correctness of those steps is established by conformance: the golden vectors and reference
tests, which replay them from the inputs.

---

## 7. Validation errors (additions to v2 §7.1)

| Code | Path | When |
|---|---|---|
| `unsupported_version` | `specVersion` | neither `uvrn-probability-input-2` nor `-input-3` |
| `invalid_input` | `question.resolveByOffset` | the offset is missing (version 3) |
| `unknown_field` | `question.resolveByOffset` | an offset is supplied on a version-2 request |
| `invalid_question` | `question.resolveByOffset` | present but not a valid offset (§3.1) |
| `invalid_question` | `question.resolveBy` | the local deadline day leaves years 0000–9999 (§3.2) |
| `invalid_question` | `question.resolveBy` | `asOf` is not before the local deadline end (§3.2) |
| `invalid_input` | `market.resolvesAt` | the cutoff's read instant is outside years 0000–9999 (§3.3) |
| `invalid_input` | `baserate.horizon.by` | the horizon's read instant is outside years 0000–9999 (§3.3) |

Verification adds the error prefix `DEADLINE_RECORD_FAILED` (§6) to v2's verifier errors.

Refusal codes are version 2's closed list, unchanged.

---

## 8. Revisions

A version-3 `revision.previousProbabilityHash` MAY name any earlier probability hash, including a
version-1 or version-2 record. Such a link is **provenance only**: a changed `questionHash` means a
changed question, so a cross-version link never asserts same-question continuity. The package never
loads the earlier record and does not enforce anything about it.

---

## 9. Golden vectors

`SPEC/vectors/probability-v3.json` holds synthetic fixtures (example.org citations, invented
questions; the "World Series shape" case is a date/offset shape, not real odds). Each case gives the
input, optional signer (the SPEC test key), and expected `status`, `basis`, `probabilities`, `band`,
refusal codes, `questionHash`, `probabilityHash`, `receiptHash`, signature (when signed), `deadline`,
and `canonicalResultSha256`. Required coverage:

- offset match (an evening-Eastern cutoff that is the next day in UTC) and offset mismatch;
- market and base-rate mismatches whose local date differs from their UTC date (the refusal message,
  which is hashed, names the local date);
- a date-only cutoff read at the local end of day;
- fractional offsets `+05:30` and `+05:45`;
- `+00:00` alongside the equivalent version-2 case (same probabilities, different hashes);
- the extreme offsets `-12:00` and `+14:00`;
- a date-only horizon at the local end of day, and the mixed date reading (§3.4);
- categorical judgment, abstention, a proportion base rate, a profile, and a signed receipt;
- `validationErrors`: missing offset (`invalid_input`); `-00:00`, `-12:01`, `+14:01`, `+24:00`
  (`invalid_question`); `asOf` exactly at the local deadline end; the year range at both ends,
  including the exact `10000-01-01T00:00Z` boundary (the lower-end case uses a year-0000 `asOf`, so
  only the range rule can fire); cutoff and horizon read instants in year 10000 (`invalid_input`);
- a unit vector for the `uvrn-probability-question-2` preimage.

`probability-v1.json` and `probability-v2.json` are unchanged and still conformance-tested.

---

## 10. Out of scope (v3)

IANA time zones and daylight-saving rules (a later version needs zone-aware day boundaries, a
boundary-search algorithm, gap and overlap rules, canonical zone identifiers, and independence from
the runtime's time-zone data). Everything out of scope for version 2 (v2 §13) remains out of scope.
