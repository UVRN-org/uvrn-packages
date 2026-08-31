import {
  CHART_PACKAGE_NAME,
  CHART_PACKAGE_VERSION,
  CHART_VARIANT,
  assertSeriesRef,
  assertWall5Refs,
  collectReceiptRefs,
  escapeXml,
  truncate,
  type ChartArtifact,
  type ChartSeriesInput,
} from './types';

const WIDTH = 720;
const HEIGHT = 360;
const PAD_L = 56;
const PAD_R = 24;
const PAD_T = 72;
const PAD_B = 48;

function layout(series: ChartSeriesInput): {
  seriesRef: string;
  receiptRefs: string[];
  historyRef?: string;
  title: string;
  pathD: string;
  dots: Array<{ x: number; y: number }>;
  markerXs: Array<{ x: number; label: string }>;
  yMin: number;
  yMax: number;
} {
  const seriesRef = assertSeriesRef(series);
  const receiptRefs = collectReceiptRefs(series);
  const historyRef = assertWall5Refs(series, receiptRefs);
  if (!series.points.length) {
    throw new Error('@uvrn/chart-memory: points required');
  }

  const vals = series.points.map((p) => p.v);
  let yMin = Math.min(...vals);
  let yMax = Math.max(...vals);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const plotW = WIDTH - PAD_L - PAD_R;
  const plotH = HEIGHT - PAD_T - PAD_B;
  const n = series.points.length;

  const xy = series.points.map((p, i) => {
    const x = PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = PAD_T + plotH - ((p.v - yMin) / (yMax - yMin)) * plotH;
    return { x, y };
  });

  const pathD = xy
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const markerXs = (series.markers ?? []).map((m) => {
    const idx = series.points.findIndex((p) => p.t === m.t);
    let i = idx;
    if (i < 0) {
      const t0 = Date.parse(series.points[0].t);
      const t1 = Date.parse(series.points[n - 1].t);
      const tm = Date.parse(m.t);
      if (Number.isFinite(t0) && Number.isFinite(t1) && Number.isFinite(tm) && t1 !== t0) {
        i = Math.min(n - 1, Math.max(0, Math.round(((tm - t0) / (t1 - t0)) * (n - 1))));
      } else {
        i = 0;
      }
    }
    return { x: xy[i]?.x ?? PAD_L, label: m.label };
  });

  return {
    seriesRef,
    receiptRefs,
    historyRef,
    title: truncate(series.title || `Claim ${series.claimId}`, 80),
    pathD,
    dots: xy,
    markerXs,
    yMin,
    yMax,
  };
}

function buildSvgBody(series: ChartSeriesInput): {
  body: string;
  seriesRef: string;
  receiptRefs: string[];
  historyRef?: string;
} {
  const L = layout(series);
  const refsLine = L.receiptRefs.length
    ? `receiptRefs ${L.receiptRefs.join(' · ')}`
    : `historyRef ${L.historyRef}`;
  const markerLines = L.markerXs
    .map(
      (m) =>
        `<line x1="${m.x.toFixed(1)}" y1="${PAD_T}" x2="${m.x.toFixed(1)}" y2="${HEIGHT - PAD_B}" stroke="#2f5d50" stroke-dasharray="4 3" stroke-width="1" opacity="0.55"/>
  <text x="${m.x.toFixed(1)}" y="${PAD_T - 10}" fill="#2f5d50" font-family="IBM Plex Sans, sans-serif" font-size="10" text-anchor="middle">${escapeXml(truncate(m.label, 24))}</text>`,
    )
    .join('\n  ');
  const dots = L.dots
    .map(
      (d) =>
        `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3.5" fill="#2f5d50"/>`,
    )
    .join('\n  ');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(L.title)}">
  <title>${escapeXml(L.title)}</title>
  <desc>seriesRef ${escapeXml(L.seriesRef)}; ${escapeXml(refsLine)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbfbf9"/>
      <stop offset="100%" stop-color="#e8efe9"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <text x="40" y="36" fill="#2f5d50" font-family="IBM Plex Sans, sans-serif" font-size="14" letter-spacing="2">UVRN · PLAIN CHART</text>
  <text x="40" y="60" fill="#1a1a1a" font-family="IBM Plex Serif, Georgia, serif" font-size="22">${escapeXml(L.title)}</text>
  <line x1="${PAD_L}" y1="${HEIGHT - PAD_B}" x2="${WIDTH - PAD_R}" y2="${HEIGHT - PAD_B}" stroke="#d4d4d4"/>
  <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${HEIGHT - PAD_B}" stroke="#d4d4d4"/>
  <text x="${PAD_L - 8}" y="${PAD_T + 4}" fill="#5c5c5c" font-family="IBM Plex Sans, sans-serif" font-size="11" text-anchor="end">${L.yMax.toFixed(2)}</text>
  <text x="${PAD_L - 8}" y="${HEIGHT - PAD_B}" fill="#5c5c5c" font-family="IBM Plex Sans, sans-serif" font-size="11" text-anchor="end">${L.yMin.toFixed(2)}</text>
  ${markerLines}
  <path d="${L.pathD}" fill="none" stroke="#2f5d50" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  <text x="40" y="${HEIGHT - 18}" fill="#1a1a1a" font-family="ui-monospace, monospace" font-size="10">seriesRef ${escapeXml(L.seriesRef)}</text>
  <text x="40" y="${HEIGHT - 4}" fill="#5c5c5c" font-family="ui-monospace, monospace" font-size="9">${escapeXml(truncate(refsLine, 120))}</text>
</svg>`;

  return {
    body,
    seriesRef: L.seriesRef,
    receiptRefs: L.receiptRefs,
    historyRef: L.historyRef,
  };
}

export function renderChartSvg(series: ChartSeriesInput): ChartArtifact {
  const { body, seriesRef, receiptRefs, historyRef } = buildSvgBody(series);
  return {
    format: 'svg',
    contentType: 'image/svg+xml; charset=utf-8',
    body,
    seriesRef,
    receiptRefs,
    historyRef,
    renderedAt: new Date().toISOString(),
    renderer: {
      name: CHART_PACKAGE_NAME,
      version: CHART_PACKAGE_VERSION,
      variant: CHART_VARIANT,
    },
  };
}

export function renderChartHtml(series: ChartSeriesInput): ChartArtifact {
  const svg = renderChartSvg(series);
  const title = truncate(series.title || `Claim ${series.claimId}`, 120);
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="uvrn-series-ref" content="${escapeXml(svg.seriesRef)}" />
<title>${escapeXml(title)}</title>
<style>
:root { --ink:#1a1a1a; --muted:#5c5c5c; --paper:#f7f7f5; --accent:#2f5d50; }
body { margin:0; font-family:"IBM Plex Sans","Source Sans 3","Segoe UI",sans-serif; color:var(--ink);
  background: radial-gradient(1200px 600px at 10% -10%, #e8efe9 0%, transparent 55%), linear-gradient(180deg,#fbfbf9 0%, var(--paper) 100%); min-height:100vh; }
main { max-width:48rem; margin:0 auto; padding:2.5rem 1.25rem 3rem; }
.brand { font-size:0.75rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--accent); }
h1 { font-family:"IBM Plex Serif",Georgia,serif; font-size:clamp(1.4rem,3vw,1.9rem); margin:0.75rem 0 1.25rem; }
.chart { overflow:auto; }
.ref { margin-top:1.5rem; font-family:ui-monospace,Menlo,monospace; font-size:0.78rem; color:var(--muted); word-break:break-all; }
.ref span { color:var(--ink); }
</style>
</head>
<body>
<main>
  <p class="brand">UVRN · plain chart</p>
  <h1>${escapeXml(title)}</h1>
  <div class="chart">${svg.body.replace(/^<\?xml[^>]*>\s*/,'')}</div>
  <p class="ref">seriesRef <span>${escapeXml(svg.seriesRef)}</span></p>
  <p class="ref">${svg.receiptRefs.length ? `receiptRefs <span>${escapeXml(svg.receiptRefs.join(' · '))}</span>` : `historyRef <span>${escapeXml(svg.historyRef ?? '')}</span>`}</p>
</main>
</body>
</html>`;

  return {
    format: 'html',
    contentType: 'text/html; charset=utf-8',
    body,
    seriesRef: svg.seriesRef,
    receiptRefs: svg.receiptRefs,
    historyRef: svg.historyRef,
    renderedAt: new Date().toISOString(),
    renderer: {
      name: CHART_PACKAGE_NAME,
      version: CHART_PACKAGE_VERSION,
      variant: CHART_VARIANT,
    },
  };
}
