# Changelog — @uvrn/probability

## 0.3.1 — 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (0.3.0 → 0.3.1): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.
- Peer ranges raised from `^5.0.0` to `^5.1.0`: `@uvrn/receipt`.

## 0.3.0 — 2026-10-02

First registry release of `@uvrn/probability`. It includes the 0.2.0 and 0.1.0 work below, which
was never published on its own.

- **New contract `uvrn-probability-3` (`SPEC/uvrn-probability-v3.md`): fixed-offset local deadlines.**
  Input `uvrn-probability-input-3` = input-2 plus a REQUIRED `question.resolveByOffset` (`±hh:mm`,
  −12:00 … +14:00 combined, `-00:00` rejected; UTC is `+00:00`). The deadline day is the local day
  `[startInstantUtc, endInstantUtcExclusive)` at that offset, recorded (hashed) as `inputs.deadline`.
  Market event cutoffs and time-to-event horizons match by interval membership; date-only
  `resolvesAt` / `horizon.by` are read at local end − 1 ms; case and subject dates keep 00:00Z.
  Records add `eventCutoffDeadlineDate` / `horizonDeadlineDate` and one fixed limitation. Question
  identity `uvrn-probability-question-2` (question-1 preimage + `resolveByOffset`); receipt claim text
  names it. Pinned origin `FORECAST_V3_ORIGIN` = `model:@uvrn/probability@0.3.0`. Fixed offsets only —
  no time zones or daylight-saving rules.
- **Errors (v3).** Missing offset → `invalid_input`; invalid offset → `invalid_question`; local deadline
  day outside years 0000–9999 or `asOf` not before its end → `invalid_question` at `question.resolveBy`.
- **`runForecast` dispatches** on `specVersion` (`input-2` or `input-3`); a version-2 request produces
  exactly the version-2 record. `verifyForecastReceipt` accepts `uvrn-probability-3` (question-2 check;
  `inputs.deadline` recomputed from the question and reported as `deadlineOk` — see below).
- **Visible to version-2 callers (text only, nothing hashed):** the `unsupported_version` message now
  lists `uvrn-probability-input-2` or `-input-3`; the verifier's `UNSUPPORTED_VERSION` message lists
  three payload versions; `PROBABILITY_HASH_FAILED` names the payload version (unchanged for v2).
- **Types.** `ForecastInput`, `ForecastHashPayload`, and `ForecastResult` are now discriminated unions
  on `specVersion` (`…V2 | …V3`). Code that spreads a `ForecastInput` and replaces `question` may need
  to name `ForecastInputV2` / `ForecastInputV3`.
- **`MarketPolicy` / `BaseRatePolicy` gain `endOfDayOffsetMinutes`** (exported through the `/odds` and
  `/baserate` subpaths). Omitted or 0 is exactly the previous reading; only the v3 path sets it. Tests
  pin v1 date-only reads at 00:00Z and v2 at UTC end − 1 ms.
- **Verification recomputes the v3 deadline.** `verifyForecastReceipt` gains `deadlineOk`: for
  `uvrn-probability-3` it recomputes `inputs.deadline` from `question.resolveBy` +
  `question.resolveByOffset` and requires an exact match; a `uvrn-probability-2` record must carry no
  `inputs.deadline`; version 1 reports `null`. Failure: `DEADLINE_RECORD_FAILED`. `verified` now also
  requires `deadlineOk` (v2 records always pass it).
- **Read-instant range (v3).** A market cutoff or time-to-event horizon whose read instant falls outside
  years 0000–9999 is `invalid_input` at `market.resolvesAt` / `baserate.horizon.by` (no receipt), so no
  v3 record renders a cutoff or horizon read instant with an extended `±YYYYYY` year (other instants
  such as `asOf` are not covered by this rule).
- New schemas `uvrn-probability-input-3` / `-result-3` and `SPEC/vectors/probability-v3.json`
  (17 cases, 11 validation errors). v1 and v2 schemas and vectors are unchanged.
- **v2 origin pinned.** `runForecast` (`uvrn-probability-2`) now emits the compatibility origin
  `FORECAST_V2_ORIGIN` = `model:@uvrn/probability@0.2.0` instead of the release-tracking
  `PROBABILITY_ORIGIN`, following the v1 precedent (`LEGACY_PROBABILITY_ORIGIN`). Output is
  byte-identical at 0.2.0; a future release no longer moves any v2 golden vector.
  `PROBABILITY_ORIGIN` is kept and exported as the current package origin (not a contract origin).
  A new test simulates a bumped package version and reruns every v1 and v2 vector unchanged.
  SPEC v2 §4.1 `origin` row clarified. A source-text test also checks that every contract origin is
  built from its own literal version, never from `PACKAGE_VERSION`.

## 0.2.0 (not released separately; shipped in 0.3.0)

- **New `runForecast` (`SPEC/uvrn-probability-v2.md`).** Input `uvrn-probability-input-2`, output/hash
  `uvrn-probability-2`. The caller selects `market | baserate | judgment`; no precedence, fallback, or
  blending. Closed input at every level; malformed requests throw `ForecastValidationError` (typed
  `code` + `path`, no receipt). Every valid request, including abstention and `insufficient_basis`,
  returns a receipted record.
- **Identities.** `questionHash` (`uvrn-probability-question-1`, NFC + trim preimage, excludes
  producer/time/probabilities/bindings), caller-supplied `forecastId` passed through unchanged, and
  `probabilityHash` over the full record. Optional `uvrn-outcome-1` declaration bindings are recomputed
  and covered by `probabilityHash` only. Optional `revision` link.
- **Judgment module** (`src/judgment`, subpath `@uvrn/probability/judgment`): evidence or labeled
  assumptions (`assumption-only` label), rationale, counterarguments, uncertainty; integer-millionths
  sum check; never normalized; optional subjective binary range; explicit abstention.
- **Output** carries `unit: '1'` and `quantityKind: 'probability'` inside the hash, ordered
  `probabilities`, labeled `band` kinds (`method-spread | bid-ask | statistical | subjective`; only
  statistical has confidence 0.95), fixed honesty `limitations`.
- **Statistics (v2 path only):** `baserate_below_min_at_risk`, `baserate_interval_unavailable` replaces
  the binomial fallback, `minCases` must be a positive integer, market event cutoff / time-to-event
  horizon must match the deadline date (`deadline_mismatch`); optional market `settlesAt` recorded only.
- **`verifyForecastReceipt`** dispatches on payload version (v1 legacy verifier; v2 inner hash,
  `questionHash`, declaration hashes, receipt/signature); unknown versions fail.
- **Legacy:** `runProbability` is unchanged in behavior and keeps `origin` `model:@uvrn/probability@0.1.0`
  (`LEGACY_PROBABILITY_ORIGIN`) so the 16 v1 golden vectors stay byte-identical. `PROBABILITY_ORIGIN`
  now names the 0.2.0 emitter. `evaluateBaseRate` gains an optional policy argument; omitted, behavior is
  exactly v1.
- **Docs:** `AGENT-GUIDE.md` (shipped via `files`), README rewritten for v2; package name confirmed.
- Thresholds remain PROVISIONAL.

### Pre-freeze hardening (v2 still unfrozen)

- **Refused market prices are recorded.** v2 market outcome records keep the submitted sportsbook
  `odds` or exchange `bid` / `ask` / `depthUsd` even when refused (`market_invalid_odds`), so different
  refused prices give different `probabilityHash` values. `impliedP` / `mid` still appear only for valid
  prices. Non-finite prices remain `invalid_input` validation errors. v1 output is unchanged.
- **Strict calendar validation (v2 only).** Every v2 date and zoned timestamp (asOf, citation
  `accessedAt`, `quotedAt`, `resolvesAt`, `settlesAt`, case dates, `subject.filedAt`, `horizon.by`,
  `resolveBy`, binding dates) must be a real calendar value; `2026-02-30`, non-leap `02-29`, `T24:00`,
  `2026-04-31`, and `+24:00` throw instead of rolling over — `invalid_input`, except `missing_citation`
  for a citation `accessedAt` and `invalid_question` for `question.resolveBy`. Zoned timestamps allow
  at most 3 fractional-second digits (see the cleanup pass below). The v1 parser in
  `src/common/time.ts` is unchanged. Input schema patterns tightened to match.
- **Closed result provenance.** `uvrn-probability-result-2.schema.json` now defines closed market,
  proportion, time-to-event, judgment-allocation, and abstention records, closed `inputs.asOf` /
  `inputs.thresholds`, and mode coupling (selected record non-null, others null; basis, band kind, and
  refusal scope follow the mode). SPEC §4.1.1 documents the records.
- **End-of-day horizon (v2 only).** A date-only time-to-event `horizon.by` is evaluated at
  23:59:59.999Z of that UTC day, matching `resolveBy`; the record adds `horizonInstantUtc`. New policy
  flag `horizonEndOfUtcDay` on `evaluateBaseRate` (omitted = v1 behavior). New vectors
  `v2-baserate-deadline-date-only` / `-zoned` (both 0.5). **Changed vectors:** `v2-baserate-competing`,
  `v2-baserate-at-risk-boundary-accepted`, `v2-baserate-at-risk-boundary-refused`, and
  `v2-baserate-interval-unavailable` changed `probabilityHash`, `receiptHash`, and
  `canonicalResultSha256` only (their date-only horizons now resolve one day later and the record gains
  `horizonInstantUtc`); status, probabilities, bands, refusal codes, and `questionHash` are identical.
- **End-of-day market event cutoff (v2 only).** A date-only market `resolvesAt` is read as
  23:59:59.999Z of that UTC day for `market_resolves_before_asof` and `timeToEventCutoffDays`; a zoned
  `resolvesAt` is read as given, and deadline matching stays by UTC date. The market record adds
  `eventCutoffInstantUtc`. New opt-in `MarketPolicy.resolvesEndOfUtcDay` on `evaluateMarket` (omitted =
  v1 behavior). New vectors `v2-market-cutoff-same-day-date-only` / `-zoned` (both 0.62; a same-day
  date-only cutoff with a mid-day `asOf` is now accepted). **Changed vectors:** `v2-market-sportsbook`
  (date-only cutoff: `timeToEventCutoffDays` 33.208333 → 34.208333, plus the new field),
  `v2-market-exchange-settles-later` and `v2-market-deadline-mismatch` (zoned cutoffs: new field only)
  changed `probabilityHash`, `receiptHash`, and `canonicalResultSha256` only; status, probabilities,
  bands, refusal codes, and `questionHash` are identical.
- **Rule profiles** (`uvrn-probability-profile-1`, SPEC §8.1): optional, data-only, tighten-only
  `profile` input (allowed modes, stricter thresholds, `require.zonedTimestamps` / `judgmentRange` /
  `citedEvidence`). New validation codes `invalid_profile` and `profile_violation`. The result records
  `profile: { specVersion, id, version, hash }` as an optional hashed member; records without a profile
  hash exactly as before. New exports: `PROFILE_SPEC_VERSION`, `computeProfileHash`,
  `THRESHOLD_DIRECTION`, `FORECAST_OPTIONAL_HASH_FIELDS`, `LIMITATION_PROFILE`, and the
  `ForecastProfile*` types. Vectors add two profile cases and a `validationErrors` section.

### Post-audit cleanup (v2 still unfrozen)

- **Millisecond timestamps (owner decision).** v2 zoned timestamps accept at most 3 fractional-second
  digits; `.9999` or `.123456789` throws the code that field already uses (`invalid_input`, or
  `missing_citation` for a citation `accessedAt`) instead of being truncated. v2 strict validator and
  input-2 schema patterns only; the v1 parser is unchanged. No existing vector used more than 3
  digits, so no vector changed.
- **Docs.** Impossible-date error codes are stated precisely; SPEC §6.2 records the end-of-day
  `horizonDays` of the time-to-event vectors (421 / 451 / 301) and why the estimates are unchanged;
  schemas and SPEC §2 say JSON Schema cannot enforce days-in-month or leap years, so schema-only
  validation is insufficient; README / AGENT-GUIDE say `runForecast` is the only strict v2 entry point
  (`evaluateMarket` / `evaluateBaseRate` keep v1 permissive parsing by design).
- **Tests.** Direct strict-time coverage for criteria, case, and outcome citations and for the
  outcome-declaration `resolveBy` / `declaredAt`, plus the fractional-digit boundary.

## 0.1.0 (not released separately; shipped in 0.3.0)

- Initial package implementing `SPEC/uvrn-probability-v1.md`.
- `/odds`: implied probability (american, decimal, fractional); multiplicative, power (default),
  and Shin de-vig with fixed-iteration bisection and typed non-convergence refusal; method spread
  folded into the band; exchange midpoint with spread/depth gates; stale-quote refusal;
  multi-outcome normalization.
- `/baserate`: Jeffreys equal-tailed interval with the Brown-Cai-DasGupta boundary rule;
  deterministic incomplete beta and inverse; Aalen-Johansen cumulative incidence with competing
  events, conditional-on-elapsed form, delta-method variance, log-log interval; declared-criteria
  similarity gate.
- Root: precedence combiner (market → base rate → insufficient_basis), `uvrn-probability-1`
  hash, `kind: 'probability'` NetworkReceipt via `@uvrn/receipt`, UCUM `"1"` probability source.
- Thresholds are PROVISIONAL placeholders pending owner decision.

### Changed
- **License:** MIT → **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name). Earlier published versions stay MIT.
