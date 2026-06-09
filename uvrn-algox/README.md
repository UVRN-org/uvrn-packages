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

The ranking shape is ported from x-algo (X's open-sourced "For You" feed
algorithm): a staged pipeline of `Filter → Scorer → Selector`. The reusable
lessons kept here are **weighted scoring**, **anti-domination diversity**, and
**freshness** — everything is a tunable knob, nothing is hardcoded.

## What this package provides

- `rankSignals(candidates, config)` — one call, ranked result out.
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

`v2.0.0` — integrated into the LIVE monorepo workspace with v2 remediation
applied. See `CHANGELOG.md`.

## License

MIT — Suttle Media LLC / UVRN-org.
