# @uvrn/probability

Deterministic, receipted forecasts. The caller picks **one** mode for a standalone question:
a **market** (cited prices), a **base rate** (a cited reference class), or an attributed
**judgment** (an agent's or human's reasoned allocation). It refuses rather than guesses.

The package is a domain-neutral probability/forecast receipt engine: it works on questions,
outcomes, prices, reference cases, and judgments, and contains no sports, finance, news, or product
logic. Adapters that turn a particular book, feed, docket, or dataset into its inputs live in the
host, outside this package.

> **Version:** 0.3.1. Thresholds are **PROVISIONAL** (see below).
> Specs: [`SPEC/uvrn-probability-v3.md`](https://github.com/UVRN-org/uvrn-packages/blob/main/SPEC/uvrn-probability-v3.md) (fixed-offset local deadlines),
> [`SPEC/uvrn-probability-v2.md`](https://github.com/UVRN-org/uvrn-packages/blob/main/SPEC/uvrn-probability-v2.md) (UTC deadlines; base of v3), and
> [`SPEC/uvrn-probability-v1.md`](https://github.com/UVRN-org/uvrn-packages/blob/main/SPEC/uvrn-probability-v1.md) (legacy).
> Agents: read the [agent operating guide](./AGENT-GUIDE.md).

## Install

```bash
npm install @uvrn/probability @uvrn/receipt
```

`@uvrn/receipt` (`^5.1.0`) is a required peer.

## What's new in 0.3.0

- **Version 3 (`uvrn-probability-input-3` → `uvrn-probability-3`): fixed-offset local deadlines.**
  `question.resolveByOffset` (`±hh:mm`) anchors `resolveBy` to a local day, recorded and hashed as
  `inputs.deadline`; `verifyForecastReceipt` recomputes it (`deadlineOk`). See
  [Local deadlines (version 3)](#local-deadlines-version-3).
- Version-2 output is pinned to `model:@uvrn/probability@0.2.0`, so v1 and v2 golden vectors stay
  byte-identical across releases.
- 0.3.0 is the first registry release; it also carries the 0.1.0 (version 1) and 0.2.0 (version 2)
  work. See [`CHANGELOG.md`](./CHANGELOG.md).

## What it does

| Entry | Purpose |
|---|---|
| `@uvrn/probability` `runForecast()` | Version 2: caller-selected mode, `questionHash`, `uvrn-probability-2` hash, NetworkReceipt |
| `@uvrn/probability` `verifyForecastReceipt()` | Dispatches on version: v2/v3 inner hashes + receipt/signature (v3 also recomputes `inputs.deadline` from the question, `deadlineOk`); v1 via the legacy verifier |
| `@uvrn/probability` `runProbability()` | Legacy version-1 compatibility emitter (fixed precedence, origin pinned to 0.1.0) |
| `@uvrn/probability/judgment` | Judgment validator and types (optional pre-check for hosts) |
| `@uvrn/probability/odds` | American/decimal/fractional → implied probability; multiplicative, **power (default)**, Shin de-vig; exchange midpoint |
| `@uvrn/probability/baserate` | Jeffreys interval; Aalen-Johansen cumulative incidence with competing events; conditional-on-elapsed form |

Mode support in this version: market and base rate are **binary only**; judgment supports binary and
categorical questions. There is no precedence, fallback, or blending in `runForecast`.

```ts
import { runForecast, verifyForecastReceipt } from '@uvrn/probability';

const result = runForecast(
  {
    specVersion: 'uvrn-probability-input-2',
    forecastId: 'host-0001',                     // yours; reused only for an identical retry
    mode: 'judgment',
    question: {
      text: 'Will the example team win the 2026 fixture series?',
      resolveBy: '2026-10-30',
      resolutionRule: 'YES if the league results page lists the example team as winner by the deadline.',
      kind: 'binary',
      outcomes: [
        { id: 'yes', label: 'Yes', definition: 'Listed as winner by the deadline.' },
        { id: 'no', label: 'No', definition: 'Not listed as winner by the deadline.' },
      ],
      partitionConfirmed: true,
    },
    asOf: { at: '2026-09-26T12:00:00-07:00', source: { url: 'https://…', accessedAt: '2026-09-26T11:00:00-07:00' } },
    producer: { id: 'research-agent', kind: 'agent', model: 'model-id' },
    judgment: {
      probabilities: [{ outcomeId: 'yes', p: 0.71 }, { outcomeId: 'no', p: 0.29 }],
      evidence: [{ id: 'e1', statement: 'Standings show a two-game lead.', source: { url: 'https://…', accessedAt: '…' } }],
      rationale: 'Lead plus remaining schedule.',
      counterarguments: ['Injuries could reverse the lead.'],
      uncertainty: 'Roster news after asOf is unknown.',
    },
  },
  { signer: { privateKey: process.env.PRODUCER_KEY!, publicKeyRef: 'acme-pk-2026-v1' } }
);

result.status;         // 'forecast' | 'insufficient_basis'
result.basis;          // 'market-implied' | 'reference-class' | 'agent-judgment' | null
result.probabilities;  // [{ outcomeId: 'yes', p: 0.71 }, { outcomeId: 'no', p: 0.29 }]
result.unit;           // '1'  (quantityKind: 'probability'; both hashed)
result.band;           // null, or { outcomeId: 'yes', low, high, kind, confidence }
result.questionHash;   // what will resolve (excludes producer, time, probabilities, bindings)
result.probabilityHash;// the complete record
result.receipt;        // uvrn-receipt-4 NetworkReceipt, kind 'probability'
verifyForecastReceipt(result.receipt, { publicKey });   // verified = integrity + signature (v3 also needs deadlineOk)
```

Malformed input throws a typed `ForecastValidationError` (`code`, `path`) and produces no receipt.
Every valid request — including an abstention (`judgment: { abstain: true, reason }`) and an
`insufficient_basis` refusal — returns a receipted record. Persisting every attempt is the host's job.

Dates and timestamps are checked as real calendar values: `2026-02-30`, `2026-02-29`, `T24:00`, and
`+24:00` are rejected instead of being rolled over by `Date.parse`, and zoned timestamps allow at most
3 fractional-second digits (`.999` is fine; `.9999` is rejected, not truncated). The error code is
`invalid_input`, except `missing_citation` for a citation `accessedAt` and `invalid_question` for
`question.resolveBy`. Version 2 only: the deadline `resolveBy` runs through 23:59:59.999Z UTC. In
version 3 it is the local day at `question.resolveByOffset` (see
[Local deadlines (version 3)](#local-deadlines-version-3)).

`runForecast` is the only strict version-2 entry point. The lower-level `evaluateMarket` /
`evaluateBaseRate` keep version-1 permissive parsing by design, and the JSON Schemas cannot check
days-in-month or leap years — validating against the input schema alone is not enough.

Every `inputs` record is closed and defined in the result schema: the selected mode's record is
filled in and the others are `null`. A refused market price is still recorded as submitted (sportsbook
`odds`, exchange `bid` / `ask` / `depthUsd`), so different refused prices give different hashes.

### Modes

- **market** — v1 de-vig/exchange math. `resolvesAt` is the market's underlying **event cutoff**.
  Version 2 only: it must fall on the question's `resolveBy` UTC date (else `deadline_mismatch`); a
  date-only `resolvesAt` is read at the end of that UTC day (23:59:59.999Z) and the record states the
  instant as `eventCutoffInstantUtc` (legacy v1 keeps 00:00Z). In version 3 the cutoff must fall in the
  local deadline day (see [Local deadlines (version 3)](#local-deadlines-version-3)). Optional `settlesAt` is recorded, never matched. `targetOutcome` is the market label for YES. Band kind `method-spread`
  (sportsbook) or `bid-ask` (exchange), no confidence level. Labeled market-implied; no bias correction.
- **baserate** — declared-criteria reference class; Jeffreys proportion or Aalen-Johansen time-to-event
  (competing events never censored). Version 2 refuses `baserate_below_min_at_risk` when fewer than
  `minCases` cases remain at risk at the elapsed time, and `baserate_interval_unavailable` instead of the
  v1 binomial fallback. Version 2 only: a time-to-event horizon must match the deadline date; a
  date-only `horizon.by` is evaluated at the end of that UTC day (23:59:59.999Z) and the record states
  the instant as `horizonInstantUtc` (legacy v1 keeps 00:00Z). In version 3 the horizon must fall in
  the local deadline day (see [Local deadlines (version 3)](#local-deadlines-version-3)). Band kind `statistical`, confidence 0.95.
- **judgment** — evidence **or** explicitly labeled assumptions (assumption-only is accepted and labeled
  `assumption-only`), plus rationale, counterarguments, and uncertainty. Allocations are checked in
  integer millionths and must sum to exactly 1; they are never normalized. Optional binary `range` is a
  `subjective` band, never a confidence interval.

UVRN readings (V-Score, agreement, drift, stance, signal) are optional and supplied by the host. The
package never imports other UVRN packages to get them and applies no automatic adjustment from them.

### Rule profiles (optional)

A host can pass a data-only `profile` (`uvrn-probability-profile-1`) that tightens a request:

```ts
profile: {
  specVersion: 'uvrn-probability-profile-1',
  id: 'acme-strict',
  version: '1.0.0',
  allowedModes: ['baserate', 'judgment'],        // omitted = all modes
  thresholds: { minCases: 12 },                  // floors may rise, ceilings may fall
  require: { zonedTimestamps: true, judgmentRange: true, citedEvidence: true },
}
```

- Tighten-only: a threshold looser than the default fails with `invalid_profile`. The effective value is
  the stricter of the profile and the caller's `thresholds` (or the default), so a caller override
  cannot undo a profile limit.
- A mode the profile does not allow, or an unmet requirement, throws `profile_violation` (no receipt).
- Unknown members fail with `unknown_field`. No callbacks or code.
- The result records `profile: { specVersion, id, version, hash }` (hash = SHA-256 of the profile's
  `uvrn-jcs-1` form), covered by `probabilityHash`; `questionHash` is unaffected. Without a profile the
  output and every hash are unchanged. The package does not verify who wrote a profile.

### Local deadlines (version 3)

Version 2 reads `question.resolveBy` as a UTC day. An event that ends on the evening of 2026-10-31 in
US Eastern time is 2026-11-01 in UTC, so a version-2 question "by 2026-10-31" refuses its market with
`deadline_mismatch`. Version 3 anchors the day to a fixed UTC offset:

```ts
runForecast({
  specVersion: 'uvrn-probability-input-3',
  // …the same members as version 2…
  question: { /* … */ resolveBy: '2026-10-31', resolveByOffset: '-04:00' },
});
```

- The deadline day is local 00:00 to the next local 00:00 at that offset, recorded as
  `inputs.deadline` (hashed). Cutoffs and horizons match when they fall inside it.
- Date-only `resolvesAt` / `horizon.by` are read at local 23:59:59.999; case and subject dates keep 00:00Z.
- **A fixed offset, not a time zone.** Pass the offset in effect on that date (e.g. `-04:00` for US
  Eastern in late October, `-05:00` after daylight saving ends). The package applies no time-zone or
  daylight-saving rules, and every v3 record says so.
- Output is `uvrn-probability-3` with question identity `uvrn-probability-question-2`. Version-2
  requests and records are unchanged.
- Verification recomputes the recorded deadline day from the question (`deadlineOk`). It does not
  re-run matching or the forecast math, and cannot tell whether the offset was right for the date.

### Legacy version 1

`runProbability` (input `uvrn-probability-input-1`) keeps the fixed precedence (market → base rate →
`insufficient_basis`), its `uvrn-probability-1` hash, and its 16 golden vectors. It is a compatibility
emitter: its records keep `origin: model:@uvrn/probability@0.1.0` so old canonical fixtures stay
reproducible. New forecasts should use `runForecast`. CLI `uvrn prob run` and MCP `delta_prob_run`
currently call `runProbability` only.

```ts
import { runProbability } from '@uvrn/probability';

const legacy = runProbability({
  specVersion: 'uvrn-probability-input-1',
  outcome: { outcomeHash: 'sha256:…' },          // a uvrn-outcome-1 declaration hash
  asOf: { at: '2026-09-26T12:00:00-07:00', source: { url: 'https://…', accessedAt: '…' } },
  market: { kind: 'sportsbook', venue: 'Example Book', domain: 'sports/baseball',
            resolvesAt: '2026-10-30', targetOutcome: 'Home', source: { url: 'https://…', accessedAt: '…' },
            outcomes: [/* cited quotes with odds + quotedAt */] },
});
legacy.method;   // 'market' | 'baserate' | 'insufficient_basis'
legacy.p;        // number, or null when insufficient_basis
```

## Honesty walls

- Every market/base-rate input cites a source URL and a zoned timestamp; judgment evidence is cited or
  the judgment is labeled assumption-only. Citation structure is checked, never content.
- No clock, no randomness, no network, no model: `asOf` is explicit. Same input + signer → byte-identical JCS output.
- All computed numbers are rounded to 6 decimals before canonicalization.
- Probability is never a V-Score and shares no field with one.

## Honest limits

- **A receipt proves integrity and which key signed. It does not prove accuracy**, the truth of cited
  sources, or that the forecast existed before the outcome.
- **A judgment is an attributed opinion.** Acceptance validates structure and arithmetic, not accuracy.
  Different agents may judge the same research differently.
- **A self-declared `asOf` does not prove prior existence.** External anchoring is future work.
- **A clean track record requires logging every output, including refusals and abstentions.** The package
  is stateless; `@uvrn/track-record` integration is optional and host-side.
- Outcome partitions are checked for structure only; the producer attests exclusivity and exhaustiveness.
- Small reference classes produce wide intervals or refusals. That is the system working.
- Floating-point determinism is pinned to Node.js LTS on V8; golden vectors are the oracle elsewhere.

## Thresholds (PROVISIONAL)

Implementer placeholders — the owner has not decided them. Each run records effective values and any
overrides in `inputs.thresholds`. Version 2 requires `minCases` to be a positive integer. A rule
profile can only make these stricter.

| Constant | Default |
|---|---|
| `MIN_CASES` | 8 (reference-class gate and, in v2, the at-risk gate) |
| `MAX_QUOTE_STALENESS_MS` | 24 h |
| `MAX_EXCHANGE_SPREAD` | 0.05 |
| `MIN_EXCHANGE_DEPTH_USD` | $1,000 |
| `MAX_SPORTSBOOK_OVERROUND` | 0.5 |

## Dependencies

Peer: `@uvrn/receipt` (canonicalization, hashing, Ed25519 signing — never duplicated). No other
runtime dependencies. `oddsmith` is a dev-only cross-check reference.

## References

Brown, Cai & DasGupta (2001), *Interval Estimation for a Binomial Proportion*. Clarke, Kovalchik &
Ingram (2017), *Adjusting Bookmaker's Odds to Allow for Overround*. Shin (1993); Jullien &
Salanié (1994). Aalen & Johansen (1978). Choudhury (2002), *Non-parametric confidence interval
estimation for competing risks analysis*.

## License

Apache License 2.0 — see [LICENSE](LICENSE). If you redistribute this package or a work derived from it, include the attribution notices from [NOTICE](NOTICE) (in short: "Built on UVRN").
