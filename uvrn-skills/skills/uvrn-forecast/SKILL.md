---
name: uvrn-forecast
description: Produce a calibrated, honestly labeled probability for a future event, such as who might win the next baseball game, using market odds, a cited base rate, or a reasoned judgment, and deliver the number with a chart. Use when the user asks for odds, a probability, a prediction, or who is likely to win or happen.
---

# UVRN-style probability layer

Gives a probability **with its basis shown**, or an honest refusal. Ported from `@uvrn/probability` (odds de-vig, Jeffreys base-rate interval, refusal rules) and `@uvrn/track-record` (Brier scoring). The script does the math; you supply the cited inputs.

This is information, not betting advice, and no probability is a guarantee.

## Workflow

1. **State the question exactly.** The event, `resolveBy` date, and a `resolutionRule` anyone could apply. Split "wins the game", "wins the series" and "wins by 5+" into separate questions. Ask one focused question if something material is ambiguous.
2. **Choose exactly ONE mode. No blending, no automatic preference.**
   - `market` — current quotes you actually read (sportsbook moneyline/odds, or an exchange bid/ask). Gives a de-vigged probability plus a band.
   - `baserate` — a cited reference class of **comparable cases** (`x` with the outcome out of `n`, at least 8). Gives a Jeffreys 95% interval. Only as good as the claim that the cases are comparable.
   - `judgment` — your own reasoned allocation across outcomes, with rationale, at least one credible counterargument, and what would change your mind. Labeled "agent judgment"; `assumption-only` if you cite nothing.
3. **Collect inputs from sources you read.** Every market and reference class needs `source: {url, accessedAt}`. Quotes need `quotedAt`. Never invent a quote or a citation.
4. **Set `asOf` to the real current time.** Do not backdate. Quotes older than 24 hours at `asOf` are refused.
5. **Run:** `node scripts/run.mjs forecast input.json --out <dir> --name <slug>`
6. **Deliver text AND the chart.** Give the number, its basis, the band and what it means, the main caveat, and the refusal if there was one. Show the HTML report (artifact if available, otherwise send the file).
7. **Ask once:** "Want a Markdown report to go with this?" If yes, re-run with `--md`.

## Input

```json
{
  "forecastId": "unique-id-you-choose",
  "asOf": "2026-10-18T12:00:00-07:00",
  "question": { "text": "…", "resolveBy": "2026-10-19", "resolutionRule": "…" },
  "mode": "market",
  "market": {
    "kind": "sportsbook", "venue": "…", "targetOutcome": "Home", "resolvesAt": "2026-10-19",
    "source": { "url": "https://…", "accessedAt": "ISO" },
    "outcomes": [
      { "label": "Home", "odds": { "format": "american", "value": -150 }, "quotedAt": "ISO" },
      { "label": "Away", "odds": { "format": "american", "value": 130 }, "quotedAt": "ISO" }
    ]
  }
}
```

- Sportsbook odds: `american`, `decimal`, or `fractional` (`numerator`, `denominator`). List **every** outcome (include the draw if there is one).
- Exchange: `"kind": "exchange"` with `bid`, `ask` (0–1) and `depthUsd` per outcome. Spread over 0.05 or depth under $1,000 is refused.
- Base rate: `"baserate": { "referenceClass": {"description": "…", "source": {…}}, "x": 3, "n": 8 }`. Under 8 cases is refused.
- Judgment: `"judgment": { "outcomes": [{"id":"home","p":0.55},{"id":"away","p":0.45}], "rationale": "…", "counterarguments": ["…"], "uncertainty": "…", "evidence": [{url, accessedAt}], "assumptions": ["…"] }`. Probabilities must sum to exactly 1 with at most 6 decimals; they are never rescaled. To abstain, set `"abstain": true`.
- Optional `"track": [{ "forecastP": 0.7, "outcome": 1 }, …]` — this forecaster's resolved past forecasts, shown as a Brier score and calibration chart.

## Rules (binding)

- **A refusal is a result.** If the script refuses (stale quote, thin market, too few cases), report that and the code. Never substitute 50% or "tune the inputs" to get a number.
- **Name the basis.** A market price is "market-implied", not your estimate; a judgment is "agent judgment"; a base rate depends on comparability. The band from a sportsbook is a spread across de-vig methods, not a confidence interval.
- **One probability cannot be confirmed or refuted by one outcome.** Calibration is judged over many forecasts. If the user wants to track accuracy, save each result JSON, and when events resolve add `{forecastP, outcome}` entries to `track`.
- Use only information available at `asOf`.
- The output is a UVRN-style estimate, not a signed receipt.
