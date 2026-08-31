# @uvrn/chart-memory

Plain-default claim history → self-contained SVG/HTML time charts. **Picture is never the proof** — every artifact embeds `seriesRef` plus `receiptRefs` and/or `historyRef`.

Official design templates arrive later via the program `design-handoff/` slot (D7). This package ships the unbranded default only.

## Usage

```ts
import { renderChartSvg, renderChartHtml } from '@uvrn/chart-memory';

const artifact = renderChartSvg(series);
// artifact.seriesRef === series.seriesId
```

Optional report upload (fixture-mocked in tests) uses the worker `/v1/reports/upload` seam — see `STORE-REPORT-R2.md`.

## Walls

- Local default needs no R2/D1 (D2)
- No Cloudflare/D1 imports (wall 4)
- No verify/hash/sign logic in the renderer (wall 5)
