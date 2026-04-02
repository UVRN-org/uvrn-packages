# @uvrn/compare

`@uvrn/compare` compares claim-level consensus outcomes. Use `compare()` for two claims head-to-head and `compareSeries()` for one claim across multiple historical receipts.

## Minimal install

```bash
npm install @uvrn/compare @uvrn/core @uvrn/drift
```

`@uvrn/timeline` is an optional peer when you want deeper historical context outside the data you already provide to `compare()`.

## Usage

```ts
import { CompareEngine } from '@uvrn/compare';

const result = CompareEngine.compare([receiptA, receiptB], {
  normalize: true,
  includeTimeline: true,
});

const series = CompareEngine.compareSeries(receiptHistory, {
  claim: 'clm_sol_001',
});
```

## `compare()` vs `compareSeries()`

- `compare()` selects the most recent receipt per claim and compares exactly two unique claims.
- `compareSeries()` looks at multiple receipts for one claim over time and returns a trend summary.

The comparison unit is always the claim, not the individual receipt.

## Input normalization

The engine accepts mixed receipt-like shapes and normalizes common fields such as:

- `claimId` or `claim_id`
- `vScore` or `v_score`
- `scoredAt`, `scored_at`, `timestamp`, or `canonized_at`
- direct or nested `status`

## `normalize: true`

In v1, `normalize: true` only converts fractional scores in the `0..1` range into `0..100` scores and clamps out-of-range values. If your inputs are already `0..100`, the flag is effectively a no-op.

## Divergence behavior

`divergenceAt` is populated only when:

- `includeTimeline: true`
- the provided input contains enough historical points for both claims
- the lead actually changes over time

Otherwise `divergenceAt` is `undefined`.

## Summary output

`summary` is designed to be short, factual, and verbatim-ready for LLM-facing output.

## Public API

- `CompareEngine`
- `CompareOptions`
- `CompareResult`
- `SeriesOptions`
- `SeriesResult`

## Dependencies

- Peer dependencies: `@uvrn/core`, `@uvrn/drift`
- Optional peer usage: `@uvrn/timeline`
- Runtime dependencies: none
