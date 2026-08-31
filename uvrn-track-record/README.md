# @uvrn/track-record

Per-origin **track records**: transcription fidelity, revision counts, and Brier-scored forecast resolution.

These are **observations** about past agreement and resolution — not honesty verdicts. They must **never** enter a hashed receipt.

## Install

```bash
pnpm add @uvrn/track-record
```

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
| SQLite | `@uvrn/store-sqlite/track-record` → `SqliteTrackRecordStore` |
| D1 via worker | `@suttlemedia/store-d1-client` → `D1ClientTrackRecordStore` |

Contract paths: `STORE-D1-API.md` `/v1/store/track-records/...`.

## Learned credibility (opt-in)

`getLearnedCredibility` / `deriveLearnedCredibility` return a [0,1] observation score when data exists. Consensus consumption is **off by default** — callers opt in and must report both declared and learned numbers.
