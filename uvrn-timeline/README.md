# @uvrn/timeline

`@uvrn/timeline` reconstructs claim history from any compatible store. It owns query logic, bucketing, chart shaping, and summary generation. It does not own storage.

## Minimal install

```bash
npm install @uvrn/timeline @uvrn/drift @uvrn/canon
```

## Usage

```ts
import { MockTimelineStore, Timeline } from '@uvrn/timeline';

const timeline = new Timeline({
  store: new MockTimelineStore(),
});

const history = await timeline.query('clm_sol_001', {
  from: '2026-01-01',
  to: '2026-03-29',
  resolution: 'daily',
});
```

## `TimelineStore` contract

`TimelineStore` is the integration contract users implement for any backend:

```ts
interface TimelineStore {
  getSnapshots(claimId: string, from: number, to: number): Promise<DriftSnapshot[]>;
  getCanonEvents(claimId: string, from: number, to: number): Promise<CanonReceipt[]>;
}
```

This package does not require a database client or storage SDK.

## Built-in store

`MockTimelineStore` is the in-memory testing/local implementation. It provides a zero-external path for package use.

## Optional `apiUrl` mode

You may provide `apiUrl` instead of `store` to fetch remote timeline data. This is additive only; the local `store` path remains fully supported and is the primary zero-dependency mode.

## Resolution behavior

- `hourly`: latest snapshot per hour bucket
- `daily`: latest snapshot per UTC day bucket
- `weekly`: latest snapshot per UTC week bucket

## Chart output

`chart()` returns chart.js and recharts compatible data:

- `labels`
- `vScores`
- `statuses`
- `canonMarkers`

All arrays are aligned by bucket index.

## Summary output

`summary` is designed to be short, factual, and verbatim-ready for LLM responses.

## Public API

- `Timeline`
- `MockTimelineStore`
- `TimelineStore`
- `TimelineResult`
- `TimelineQueryOptions`
- `TimelineResolution`
- `ChartData`

## Dependencies

- Peer dependencies: `@uvrn/core`, `@uvrn/drift`, `@uvrn/canon`
- Runtime dependencies: none
