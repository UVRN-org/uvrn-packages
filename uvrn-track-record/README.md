# @uvrn/track-record

Per-origin **track records**: transcription fidelity, revision counts, and Brier-scored forecast resolution.

These are **observations** about past agreement and resolution — not honesty verdicts. They must **never** enter a hashed receipt.

**Version:** 5.1.1 (5.1 alignment; no behaviour change). **What's new in 5.1.0:** forecast log (log every output, refusals included),
multi-class Brier (`brierMultiScore`, `scoringRule: 'brier-multi'`), and `reliabilityBins` — see
[Forecast log, multi-class Brier, reliability bins](#forecast-log-multi-class-brier-reliability-bins).
All additive; binary Brier and learned credibility are unchanged.

## Install

```bash
npm install @uvrn/track-record
# or: pnpm add @uvrn/track-record
```

No runtime dependencies.

## Offline default

```ts
import {
  InMemoryTrackRecordStore,
  buildForecastResolution,
  isFaithfulTranscription,
  formatTrackRecordObservation,
} from '@uvrn/track-record';

const store = new InMemoryTrackRecordStore();

await store.addTranscription({
  originId: 'origin:example',
  sampleId: 's1',
  observedAt: new Date().toISOString(),
  faithful: isFaithfulTranscription(100, 100),
  originValue: 100,
  restatedValue: 100,
});

const record = await store.getRecord('origin:example');
console.log(formatTrackRecordObservation(record!));
```

## Persistence

| Backend | Package |
|---|---|
| In-memory (default) | this package |
| SQLite | `@uvrn/store-sqlite/track-record` → `SqliteTrackRecordStore` (`@uvrn/store-sqlite` ≥ 5.1.0 for the forecast log) |


## Forecast log, multi-class Brier, reliability bins

Optional store methods (additive; existing implementations stay valid):

| Method | Purpose |
|---|---|
| `logForecast(entry)` | Append **every** produced output, refusals included (`refused: true`, `forecastP: null`) |
| `listForecastLog(originId)` | Logged outputs, ordered by `loggedAt` then `forecastId` |
| `addMultiForecastResolution(r)` | Multi-class resolution scored with `brierMultiScore` (range 0–2, `scoringRule: 'brier-multi'`) |
| `listForecastResolutions(originId)` | Per-forecast binary + multi resolutions for `reliabilityBins` |

`reliabilityBins(resolutions, n)` builds equal-width bins; multi-class forecasts contribute one-vs-rest
pairs per class. Multi-class Brier is aggregated in `forecastsMulti` and never mixes into the binary
`forecasts.meanBrier` or learned credibility.

A track record that only logs the outputs you like is not a track record — log first, resolve later.

| Backend | Forecast log + multi-class |
|---|---|
| In-memory | yes |
| SQLite | yes (new additive tables) |

## Learned credibility (opt-in)

`getLearnedCredibility` / `deriveLearnedCredibility` return a [0,1] observation score when data exists. Consensus consumption is **off by default** — callers opt in and must report both declared and learned numbers.

## License

Apache License 2.0 — see [LICENSE](LICENSE). If you redistribute this package or a work derived from it, include the attribution notices from [NOTICE](NOTICE) (in short: "Built on UVRN").
