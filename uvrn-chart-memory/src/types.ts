/**
 * @uvrn/chart-memory — plain-default history time charts.
 * No hash/sign/verify logic here (wall 5 — picture is never the proof).
 */

export const CHART_PACKAGE_NAME = '@uvrn/chart-memory';
export const CHART_PACKAGE_VERSION = '5.0.0';
export const CHART_VARIANT = 'plain-default' as const;

export interface ChartPoint {
  t: string;
  v: number;
  status?: string;
  receiptHash?: string;
}

export interface ChartMarker {
  t: string;
  label: string;
  receiptHash?: string;
}

/** Minimal series-shaped input — compatible with timeline ChartData via adapter. */
export interface ChartSeriesInput {
  seriesId: string;
  claimId: string;
  title?: string;
  points: ChartPoint[];
  markers?: ChartMarker[];
  historyRef?: string;
}

export interface ChartRendererInfo {
  name: typeof CHART_PACKAGE_NAME;
  version: string;
  variant: typeof CHART_VARIANT;
}

export interface ChartArtifact {
  format: 'svg' | 'html';
  contentType: string;
  body: string;
  /** MUST equal series.seriesId — wall 5 series identity. */
  seriesRef: string;
  /** Distinct receiptHash values from points/markers. */
  receiptRefs: string[];
  historyRef?: string;
  renderedAt: string;
  renderer: ChartRendererInfo;
}

/** Structural subset of @uvrn/timeline ChartData — no hard dependency required. */
export interface TimelineChartDataLike {
  labels: string[];
  vScores: number[];
  statuses: string[];
  canonMarkers: Array<{
    index: number;
    label: string;
    timestamp: string;
  }>;
}

export function assertSeriesRef(series: ChartSeriesInput): string {
  const ref = series.seriesId?.trim();
  if (!ref) {
    throw new Error('@uvrn/chart-memory: seriesId required (seriesRef / wall 5)');
  }
  return ref;
}

export function collectReceiptRefs(series: ChartSeriesInput): string[] {
  const set = new Set<string>();
  for (const p of series.points) {
    const h = p.receiptHash?.trim();
    if (h) set.add(h);
  }
  for (const m of series.markers ?? []) {
    const h = m.receiptHash?.trim();
    if (h) set.add(h);
  }
  return [...set];
}

export function assertWall5Refs(
  series: ChartSeriesInput,
  receiptRefs: string[],
): string | undefined {
  const historyRef = series.historyRef?.trim() || undefined;
  if (receiptRefs.length === 0 && !historyRef) {
    throw new Error(
      '@uvrn/chart-memory: wall 5 — need receiptHash on points/markers or a historyRef',
    );
  }
  return historyRef;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function fromTimelineChartData(
  chart: TimelineChartDataLike,
  meta: { seriesId: string; claimId: string; title?: string; historyRef?: string },
): ChartSeriesInput {
  const points: ChartPoint[] = chart.labels.map((label, i) => ({
    t: label,
    v: chart.vScores[i] ?? 0,
    status: chart.statuses[i],
  }));
  const markers: ChartMarker[] = (chart.canonMarkers ?? []).map((m) => ({
    t: m.timestamp || chart.labels[m.index] || String(m.index),
    label: m.label,
  }));
  return {
    seriesId: meta.seriesId,
    claimId: meta.claimId,
    title: meta.title,
    points,
    markers,
    historyRef: meta.historyRef,
  };
}
