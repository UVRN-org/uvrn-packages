# @uvrn/algox

## Minimal install

```bash
npm install @uvrn/algox
```

No other `@uvrn/*` packages are required. `@uvrn/algox` has zero runtime dependencies.

`@uvrn/algox` turns a pile of candidates gathered by UVRN agents into a ranked
list of the **most prominent signals** — scored, de-duplicated, diversity-capped,
and freshness-filtered. It is pure logic with **no UI**, so any dashboard can call
it and render the result.

The ranking shape is adapted from the
[x-algorithm](https://github.com/xai-org/x-algorithm) (X's open-sourced
"For You" feed algorithm, Apache License 2.0): a staged pipeline of
`Filter → Scorer → Selector`. The reusable lessons kept here are **weighted
scoring**, **anti-domination diversity**, and **freshness** — everything is a
tunable knob, nothing is hardcoded. See the [Attribution](#attribution)
section and the `NOTICE` file for the full credit.

## What this package provides

- `rankSignals(candidates, config)` — one call, ranked result out.
- `reportRankStability(candidates, options)` — baseline ranking plus which identities **survive** or **reorder** under declared weight variants (ordering stability only — not verification, accuracy, or market outcome).
- `measurementResultsToCandidates` / `rankMeasurementResults` — thin bridge from measurement-result-like rows → `Candidate[]` / `rankSignals` (packages APIs only; not verification).
- A composable pipeline (`runPipeline`) and individual stages you can re-wire.

## What you provide

- `Candidate[]` — whatever your agents gathered. Only `label` is required; `url`,
  `source`, `prominence`, `observedAt`, and a free-form `signals` map are used
  when present, and any extra fields pass through to the output.

## Install

```bash
pnpm add @uvrn/algox
```

## Usage

```ts
import { rankSignals } from '@uvrn/algox';

const candidates = [
  { label: 'oversized blazers', url: 'https://vogue.com/a', source: 'vogue.com',
    prominence: 90, observedAt: '2026-05-20', signals: { mentions: 1200 } },
  { label: 'quiet luxury', url: 'https://vogue.com/b', source: 'vogue.com',
    prominence: 85, observedAt: '2026-05-21', signals: { mentions: 1500 } },
  // ...more from your agents
];

const result = await rankSignals(candidates, {
  topK: 10,          // how many to keep
  capPerSource: 3,   // max per source — stops one outlet dominating
  maxAgeDays: 30,    // drop stale signals (null disables)
  weights: { prominence: 1, mentions: 0.001 }, // blend signals, your weights
});

result.ranked;   // ScoredCandidate[] — highest score first, ready to render
result.dropped;  // what was filtered out, each with a `reason`
result.warnings; // e.g. insufficient_candidates, unparseable_date
result.config;   // the knobs actually used
```

Feed `result.ranked` straight into any dashboard component.

## Rank stability (ordering under re-weight)

Use `reportRankStability` when you need to know which baseline ranks hold under alternative weightings. The report is about **ordering stability**, not whether a ranking is verified, accurate, or predictive of market outcome.

```ts
import { reportRankStability, DEFAULT_RANK_STABILITY_VARIANTS } from '@uvrn/algox';

const stability = await reportRankStability(candidates, {
  baseline: { now: '2026-05-24T00:00:00.000Z', weights: { prominence: 1 } },
  // omit variants to use DEFAULT_RANK_STABILITY_VARIANTS (N=3 implementer PREP proposal)
});

stability.baseline.rankedLabels; // baseline order
stability.variants;              // per-variant ranked label lists
stability.report;                // { identity, label, baselineRank, status: 'survive'|'reorder', variantRanks }
```

Default variants (`DEFAULT_RANK_STABILITY_VARIANTS`) are an implementer PREP proposal for this unit — not product law:

| Name | Weights |
|---|---|
| `mentions-only` | `{ mentions: 1 }` |
| `prominence-mentions-balanced` | `{ prominence: 1, mentions: 1 }` |
| `mentions-dominant` | `{ prominence: 0.25, mentions: 1 }` |

An identity **survives** when it occupies the same 1-based rank in every variant ranking; otherwise it **reorders**. Identity is `id` when present, else the normalized label.

## Measurement → ranked signals (bridge)

Hosts that already have measurement results (agree / disagree / conflict / potential) can map them into algox candidates without hand-building `Candidate[]`. This closes the measure→rank gap; it does **not** claim measurement output is verified, accurate, or a market outcome.

```ts
import { measurementResultsToCandidates, rankMeasurementResults } from '@uvrn/algox';

const results = [
  { type: 'agree', verdict: 'agree', confidence: 0.9, explanation: '…', evidenceRefs: ['a', 'b'] },
  { type: 'disagree', verdict: 'disagree', confidence: 0.55, explanation: '…' },
];

// Mapper only
const candidates = measurementResultsToCandidates(results);

// Or one-call into existing rankSignals (defaults maxAgeDays: null)
const ranked = await rankMeasurementResults(results, { topK: 5 });
ranked.ranked; // ScoredCandidate[] — ordering under weights, not verification
```

Prominence is `confidence × 100` when confidence is present. Extra fields (`measurementType`, `measurementVerdict`, `explanation`, `evidenceRefs`) pass through on the candidate. Insufficient-data rows are kept by default so hosts see the gap (`includeInsufficient: false` to omit).

## Tuning knobs

| Knob | Default | Effect |
|---|---|---|
| `topK` | `10` | How many signals to surface |
| `capPerSource` | `3` | Max signals per `source` (diversity / anti-domination) |
| `maxAgeDays` | `30` | Drop signals older than this; `null` disables |
| `weights` | `{ prominence: 1 }` | Per-signal weights blended into the score |

## Composing your own pipeline

```ts
import {
  runPipeline, dropMissing, dedupByKey, weightedScorer, capPerGroup, topK, hostOf,
} from '@uvrn/algox';

const ctx = await runPipeline({
  query: { candidates },
  stages: [
    dropMissing('label'),
    dedupByKey((c) => c.url ?? c.label),
    weightedScorer({ weights: { prominence: 1 } }),
    capPerGroup({ groupBy: (c) => c.source ?? hostOf(c.url) ?? c.label, cap: 3 }),
    topK({ k: 10 }),
  ],
});
ctx.selected; // ranked output
```

## Status

`v4.0.0` — part of the v4 protocol generation. See `CHANGELOG.md`.

## Attribution

The signal-ranking approach in this package — the staged
`Filter → Scorer → Selector` pipeline shape, weighted scoring,
anti-domination diversity capping, and freshness filtering — was adapted
from [`xai-org/x-algorithm`](https://github.com/xai-org/x-algorithm), the
open-sourced recommendation system behind X's "For You" feed, released under
the Apache License 2.0. The package name `algox` nods to that origin. The
adaptation is a reimplementation for UVRN's use case, not a copy; full
details in the `NOTICE` file shipped with this package. This package is not
affiliated with or endorsed by X Corp. or X.AI Corp.

## License

MIT — Suttle Media LLC / UVRN-org. Third-party attribution: see `NOTICE`.
