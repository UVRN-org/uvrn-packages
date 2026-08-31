# @uvrn/pattern

Read UVRN measurement history and emit **`PatternObservation`**s — statistical observations over
provable artifacts. **Detected ≠ verified ≠ true.** Observations are **not receipt-class** (not
hashed/signed like `NetworkReceipt` / `MasterReceipt`).

## Install

```bash
pnpm add @uvrn/pattern
```

## Usage

```typescript
import {
  InMemoryHistoryReader,
  scanPatterns,
  FrequencySpikeDetector,
} from '@uvrn/pattern';

const reader = new InMemoryHistoryReader([
  { id: '1', subjectRef: 'claim:a', observedAt: '2026-08-01T00:00:00.000Z' },
  { id: '2', subjectRef: 'claim:a', observedAt: '2026-08-02T00:00:00.000Z' },
  { id: '3', subjectRef: 'claim:a', observedAt: '2026-08-03T00:00:00.000Z' },
]);

const result = await scanPatterns(
  reader,
  {
    joinScope: 'demo-origins-window',
    window: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' },
  },
  new FrequencySpikeDetector({ minCount: 3 })
);
// result.status: observations | insufficient | measured-gap | refused
// Never labels patterns "verified".
```

## Store-API bet (load-bearing)

v0 assumes hosts can batch/read via **existing** store history APIs (`SqliteReceiptStore.list()`,
`TrackRecordStore.listRecords()`, timeline window reads, etc.) and map rows into `HistoryEvent`s —
**no new cross-claim index**. Helpers:

- `historyEventsFromTrackRecords`
- `historyEventsFromStoredReceipts`

If a host cannot answer even a trivial scoped batch, `scanPatterns` returns
`status: 'measured-gap'` with `escalate: true`. That is a **measured engineering gap** — expand-later
index may become required. Do **not** invent a second ledger or rewrite `uvrn-receipt-4`.

## MCP

Tip tool: `delta_pattern_scan` on `@uvrn/mcp` (additive). Requires explicit `joinScope` + `window` +
host-supplied `history` batch (or injected `RuntimeConfig.patternHistoryReader`).

## Honesty walls

- Every observation carries `joinScope` and `falsePositiveStance: "disclosed-inherent"`.
- `confidenceNote` discloses uncalibrated v0 baseline.
- Detection quality gate (FP ceiling / goldens) is **deferred** unless Admin names floors at start.
