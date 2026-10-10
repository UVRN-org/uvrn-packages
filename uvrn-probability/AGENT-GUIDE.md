# Forecasting with @uvrn/probability — agent operating guide

Portable instructions for agents (and the humans supervising them) that produce forecasts with
`runForecast` in `@uvrn/probability` 0.3.0 (SPEC/uvrn-probability-v2.md; version 3,
SPEC/uvrn-probability-v3.md, adds fixed-offset local deadlines). This is documentation, not an installed skill, hook, or
toggle: the package has no persistent on/off state and starts no background work. Do not invoke a
tool you do not actually have.

The package is domain-neutral: it knows questions, outcomes, prices, reference cases, and judgments,
not sports, finance, news, or permits. Turning a particular feed, book, docket, or dataset into these
inputs is the job of a host-side adapter, not of the package.

## Activation

- **Off** — the user says "forecasting off": continue ordinary research without calling the package.
  Off does not delete earlier forecasts, disable other tools, or uninstall anything.
- **On-demand (default)** — forecast only when the user asks for an outcome probability.
- **On for a named scope** — "use it for this project/session": forecast qualifying questions within
  that named scope until told otherwise.

These are agent instructions. Each agent or host must receive the setting explicitly; do not claim it
propagates to other agents.

## Procedure

1. **State the question.** Exact event, deadline (`resolveBy`, a UTC date that runs through 23:59:59.999Z; for a local
   deadline use version 3 with `resolveByOffset`, see below), outcome definitions, and the
   rule for deciding the result. Ask one focused question if a material ambiguity remains. "Approved,"
   "construction started," and "in service" are separate questions. Specify the year of a recurring
   event. Set `partitionConfirmed: true` only when the outcomes are mutually exclusive and exhaustive.
2. **Choose one mode explicitly.** `market` uses matching current quotes; `baserate` uses a defensible
   comparable class; `judgment` is your reasoned assessment. There is no automatic preference or
   blending. A judgment can discuss a market or base rate as an anchor, but remains judgment and must
   explain why its final number differs. Market and base-rate modes are binary only; categorical
   questions use judgment. For a market, `resolvesAt` is the market's underlying **event cutoff** and
   must fall on the question's deadline date; put the settlement date in `settlesAt`. Confirm yourself
   that the market's event is the same event — the package only matches dates. Version 2 only: a
   date-only `resolvesAt` or time-to-event `horizon.by` is read at the end of that UTC day (in version
   3, at the end of that local day at `resolveByOffset`; see Local deadlines below); the records state
   the instant used as `eventCutoffInstantUtc` / `horizonInstantUtc`.
3. **Separate facts from assumptions.** Cite only sources you actually read. Conversational speculation
   is allowed when named as such, in `assumptions`. A judgment needs evidence or labeled assumptions; an
   assumption-only judgment is accepted and labeled `assumption-only`. Never invent a citation to avoid
   that label. A URL's presence is not evidence that the source supports the claim. Hosts that want to
   compare assumption-only forecasts later must keep the label with the record.
4. **In judgment mode**, provide the allocation, a concise rationale, credible counterarguments, and
   uncertainty (including what would change your view). Supply producer identity and model identifier
   when known. This is a reviewable explanation, not hidden reasoning or a transcript. Probabilities
   must sum to exactly 1 with at most six decimals; the package rejects, never rescales, a bad sum.
5. **Supply an explicit evaluation time** (`asOf`). Include only information known at that time; never
   backdate to simulate a successful prediction. Self-declared dates do not prove prior existence.
   Every date and timestamp must be a real calendar value (no Feb 30, no `T24:00`, no `+24:00`) with
   at most 3 fractional-second digits; the package rejects an impossible value rather than rolling it
   into another day. Call `runForecast` — it is the only strict entry point; the lower-level
   `evaluateMarket` / `evaluateBaseRate` keep the permissive version-1 parsing, and schema validation
   alone does not check real dates.
6. **Invoke the package** through an available host adapter or its library interface. Missing tool
   support is a setup limitation; never claim a call ran when it did not.
7. **Report** the outcome probabilities, `basis`, `asOf`, and uncertainty. Call an agent-produced number
   an agent judgment. Evidence quality may appear separately; do not convert it into chance. UVRN
   readings (V-Score, agreement, drift, stance, signal) are optional; missing readings never block a
   forecast, and nothing adjusts the number from them automatically. If your judgment weighed evidence
   quality or disagreement, say so in the rationale rather than claiming the readings were unused.
8. **On abstention or insufficient basis**, report that result; never fill in 50% or another placeholder.
   On a validation error, correct only the actual error; do not tune inputs to bypass a mathematical
   refusal.
9. **Log.** If authorized host logging exists, log every issued record, including refusals and
   abstentions. Malformed requests throw typed validation errors with no receipt; log those separately.
   Otherwise return the record and disclose that it was not persisted. The package logs nothing.
10. **Identities.** Supply the `forecastId` yourself. Reuse it only to retry the identical request; a
    revision gets a new `forecastId` and a `revision` link to the previous `probabilityHash` with a
    reason. Preserve the previous record. A changed question or resolution rule — even a wording or typo
    fix — gets a new `questionHash` and begins a new series.
11. **Rule profiles (optional).** If the host or user gives you a rule profile, pass it unchanged as
    `profile`. A profile can only tighten: restrict modes, raise `minCases` or depth floors, lower
    staleness/spread/overround ceilings, and require zoned timestamps, a binary judgment range, or cited
    evidence. A disallowed mode or unmet requirement throws `profile_violation`: choose an allowed mode,
    meet the requirement, or abstain — never drop or edit the profile to get a number. Never write a
    profile to loosen a default; the package rejects it (`invalid_profile`). Report the profile `id`
    and `version` with the forecast; the record carries them plus the profile hash.

Default thresholds (`minCases`, quote staleness, exchange spread and depth, sportsbook overround) are
**PROVISIONAL** placeholders. Every record states the effective values in `inputs.thresholds`.

## Outcomes and uncertainty

For "the example team wins the specified series," YES and NO exhaust the outcomes. An illustrative 71%
YES leaves 29% NO. Do not attach a third "unknown" share to represent weak knowledge.

For a permit decision, approved / denied-or-withdrawn / still pending at the deadline can be three
outcomes when the definitions are exhaustive and non-overlapping. "Pending" is an operational state at
the deadline, which is acceptable; "unknown" used merely because you lack information is not — put weak
knowledge in `uncertainty` or a binary `range`. An illustrative 60/30/10 split is a categorical
judgment, not a construction-completion forecast. Code checks sums and required definitions; it cannot
certify their meaning.

## Walkthroughs (instruction checks)

- **Off.** User: "forecasting off." You keep researching and make no forecast calls.
- **On-demand.** User asks "what are the odds the fixture permit is approved by June 30?" You state the
  question, pick a mode, run one forecast, and report it with its basis and receipt hash.
- **Scoped on.** User: "forecast everything in this permitting project." You forecast qualifying questions
  in that project only, each with its own `forecastId`.
- **Missing evidence.** You have read nothing citable. Either abstain (`{ abstain: true, reason }`) or give
  an assumption-only judgment whose `assumptions` name the speculation; the record is labeled
  `assumption-only`.
- **Revised forecast.** New information arrives. Keep the question text identical (same `questionHash`),
  use a new `forecastId`, and set `revision: { previousProbabilityHash, reason }`.

## Example (executed by the package test suite)

A binary, assumption-only judgment with synthetic example.org data:

```json
{
  "specVersion": "uvrn-probability-input-2",
  "forecastId": "guide-example-1",
  "mode": "judgment",
  "question": {
    "text": "Will the synthetic Example Line permit be approved by 2027-06-30?",
    "resolveBy": "2027-06-30",
    "resolutionRule": "YES if the example.org docket shows an approval order dated on or before the deadline.",
    "kind": "binary",
    "outcomes": [
      { "id": "yes", "label": "Approved", "definition": "An approval order is dated on or before the deadline." },
      { "id": "no", "label": "Not approved", "definition": "No approval order is dated on or before the deadline." }
    ],
    "partitionConfirmed": true
  },
  "asOf": { "at": "2026-09-27T12:00:00Z", "source": { "url": "https://example.org/clock", "accessedAt": "2026-09-27T12:00:00Z" } },
  "producer": { "id": "guide-agent", "kind": "agent" },
  "judgment": {
    "probabilities": [{ "outcomeId": "yes", "p": 0.35 }, { "outcomeId": "no", "p": 0.65 }],
    "assumptions": [{ "id": "a1", "statement": "Speculative: assume a typical review length for this synthetic docket." }],
    "rationale": "No sources read; a labeled prior leaning against approval within nine months.",
    "counterarguments": ["An expedited schedule would make approval by the deadline likely."],
    "uncertainty": "Entirely assumption-driven; the docket calendar would change this materially."
  }
}
```

`runForecast(example)` returns `status: 'forecast'`, `basis: 'agent-judgment'`, probabilities
`[yes 0.35, no 0.65]`, `inputs.judgment.basisLabel: 'assumption-only'`, `band: null`, and an unsigned
receipt (integrity-checkable only; pass a `signer` to make it verifiable).

## Local deadlines (version 3)

When the deadline is a local day (an evening event in US time, say), use `specVersion:
'uvrn-probability-input-3'` and add `question.resolveByOffset` — the fixed UTC offset **in effect on
that date** (`-04:00` for US Eastern in late October; `-05:00` after daylight saving ends). The
package applies no time-zone rules: choosing the right offset is your attestation, and the record
says so. A missing offset is a validation error; there is no default.

## Limits to explain

- Judgment estimates are permitted, not validated for predictive accuracy by acceptance.
- Package arithmetic and serialization are reproducible for fixed inputs; independent agents may judge
  the same research differently.
- A method-spread band, bid/ask band, subjective range, and statistical interval mean different things.
  Use the returned `band.kind`; only statistical intervals carry `confidence: 0.95`. Never invent a
  confidence percentage.
- A signature verifies a producing key and record integrity — not the truth of cited claims, identity
  beyond the key's established attribution, or the likelihood of the forecast.
- Filing-based base rates cannot evaluate an unfiled subject by inventing a filing date; use judgment,
  gather a reference class with another defined origin, or abstain. Any statement about a real
  project's filing status needs fresh research.
- No live ingest, publication, external messages, or storage write follows automatically from forecasting
  activation. Those actions follow their own user authorization and host rules.
