---
name: uvrn-trends
description: Calculate and chart a trend from a dated series of values, with robust statistics, a significance test, outlier flags and a projection, and honest cautions. Use when the user asks whether something is rising or falling, to find or quantify a trend, or to compare change over time.
---

# UVRN-style trend analysis

Computes direction and size of a trend from points you collect, refuses when there is too little data, and draws it. Note: unlike the other two skills, trend math is **new in this plugin** (no `@uvrn` package computes trends); it follows UVRN's honesty rules, not a port of UVRN code.

## Workflow

1. **Define the measure.** One quantity, one unit, one definition throughout the series. If the definition changed over time (a metric redefined, a rebased index), split the series or say so.
2. **Collect at least 5 dated points** (10+ is much better) from sources you read. Put each source URL on its point. Prefer one consistent source over a patchwork; if you must mix sources, say so.
3. **Optionally cross-check the individual figures** with the `uvrn-factcheck` skill when a single point carries a lot of weight.
4. **Run:** `node scripts/run.mjs trend input.json --out <dir> --name <slug>`
5. **Deliver text AND the chart:** direction, the Theil–Sen slope with units (value unit per day), first-to-last change, the Mann–Kendall result, any outliers, the projection with its caveat, and the cautions the script returned. Show the HTML report (artifact if available, otherwise send the file).
6. **Ask once:** "Want a Markdown report to go with this?" If yes, re-run with `--md`.

## Input

```json
{
  "title": "Median home price, Riverside County",
  "options": { "xUnit": "day", "horizon": 30, "minPoints": 5 },
  "points": [ { "t": "2026-01-01", "v": 612000, "source": "https://…", "note": "optional" } ]
}
```

`t` is an ISO date/time (or a number of days). `horizon` is how far ahead to extrapolate, in days.

**Time is always measured in days.** `xUnit` accepts only `"day"` (the default when omitted); any other value (`"month"`, `"week"`, `"year"`, an empty string, `null`) returns `invalid` instead of relabelling per-day numbers. Slopes are therefore **per day**. If a monthly figure helps the reader, multiply the per-day slope by 30.44 and call it an *approximate average-month rate*, not an exact monthly slope.

## What the numbers mean

- **Theil–Sen slope** is the headline (median of pairwise slopes, resistant to outliers). **OLS** is shown with a 95% CI and R². If they disagree in sign, say outliers or non-linearity are driving it.
- **Mann–Kendall p < 0.05** means a monotonic trend is statistically detectable. With fewer than ~10 points "no significant trend" may only mean "not enough data".
- The **projection is a straight-line extrapolation**, not a forecast. Say that whenever you quote it. For a probability of a future event, use `uvrn-forecast`.
- Real series are autocorrelated, which makes p-values optimistic. Pass the cautions through.
- A trend is an association in the supplied points. Do not claim a cause.
- `insufficient-data` is an honest answer; do not fabricate points to reach the minimum.
