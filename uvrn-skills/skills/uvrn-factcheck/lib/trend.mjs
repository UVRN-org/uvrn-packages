// Trend analysis. NOTE: this is NEW in uvrn-skills — no @uvrn package computes trends.
// It follows UVRN's honesty rules instead: robust statistics, explicit refusals, observation language only.
// Descriptive statistics: a trend is an association in the supplied points, not a cause or a prediction.
// Built on UVRN (Apache-2.0). See ../NOTICE.
const DAY = 86_400_000;
// two-sided 95% Student-t critical values for df 1..30; 1.96 beyond
const T95 = [12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
const tcrit = (df) => (df >= 1 && df <= 30 ? T95[df - 1] : 1.96);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function erf(x) { // Abramowitz–Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/** points: [{ t: ISO string | number, v: number, source?: url, note?: string }] */
export function analyzeTrend(points, opts = {}) {
  const minPoints = opts.minPoints ?? 5;
  const xUnit = opts.xUnit ?? 'day';
  const errors = [];
  const clean = [];
  (points ?? []).forEach((p, i) => {
    const t = typeof p.t === 'number' ? p.t : Date.parse(p.t);
    if (!Number.isFinite(t) || !Number.isFinite(p.v)) errors.push(`point ${i}: needs a valid t and finite v`);
    else clean.push({ ...p, tMs: typeof p.t === 'number' ? p.t * DAY : t });
  });
  if (errors.length) return { status: 'invalid', errors };
  clean.sort((a, b) => a.tMs - b.tMs);
  const n = clean.length;
  if (n < minPoints) return { status: 'insufficient-data', n, minPoints, reason: `${n} points is below the minimum ${minPoints}; no trend is reported rather than guessing one.` };
  const t0 = clean[0].tMs;
  const x = clean.map((p) => (p.tMs - t0) / DAY), y = clean.map((p) => p.v);
  if (new Set(x).size < 3) return { status: 'insufficient-data', n, minPoints, reason: 'fewer than 3 distinct time values' };

  // OLS
  const xbar = mean(x), ybar = mean(y);
  const sxx = x.reduce((s, v) => s + (v - xbar) ** 2, 0), sxy = x.reduce((s, v, i) => s + (v - xbar) * (y[i] - ybar), 0);
  const slope = sxy / sxx, intercept = ybar - slope * xbar;
  const resid = y.map((v, i) => v - (intercept + slope * x[i]));
  const sse = resid.reduce((s, r) => s + r * r, 0), sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const df = n - 2, s2 = sse / df, seSlope = Math.sqrt(s2 / sxx), tc = tcrit(df);
  const ols = { slope, intercept, r2: sst === 0 ? 0 : 1 - sse / sst, seSlope, ci95: [slope - tc * seSlope, slope + tc * seSlope], residualSd: Math.sqrt(s2) };

  // Theil–Sen (robust to outliers)
  const slopes = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
  const tsSlope = median(slopes), tsIntercept = median(y.map((v, i) => v - tsSlope * x[i]));

  // Mann–Kendall (tie-corrected, normal approximation)
  let S = 0; for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i]);
  const ties = new Map(); y.forEach((v) => ties.set(v, (ties.get(v) ?? 0) + 1));
  let varS = (n * (n - 1) * (2 * n + 5)) / 18;
  for (const c of ties.values()) if (c > 1) varS -= (c * (c - 1) * (2 * c + 5)) / 18;
  const z = S === 0 || varS <= 0 ? 0 : (S - Math.sign(S)) / Math.sqrt(varS);
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const tau = S / ((n * (n - 1)) / 2);

  const direction = p < 0.05 ? (tsSlope > 0 ? 'rising' : 'falling') : 'no-significant-trend';
  const first = y[0], last = y[n - 1];
  const percentChange = first === 0 ? null : ((last - first) / Math.abs(first)) * 100;

  // robust outliers (MAD)
  const med = median(y), mad = median(y.map((v) => Math.abs(v - med)));
  const outliers = mad === 0 ? [] : clean.map((pt, i) => ({ i, rz: (0.6745 * (y[i] - med)) / mad })).filter((o) => Math.abs(o.rz) > 3.5).map((o) => ({ index: o.i, t: clean[o.i].t, v: y[o.i], robustZ: Number(o.rz.toFixed(2)) }));

  // moving average (window 3)
  const ma = y.map((_, i) => (i < 2 ? null : (y[i] + y[i - 1] + y[i - 2]) / 3));

  // projection (OLS, 95% prediction interval) — extrapolation, not a forecast
  const horizon = opts.horizon ?? Math.max(1, Math.round((x[n - 1] - x[0]) / 4));
  const x0 = x[n - 1] + horizon;
  const yhat = intercept + slope * x0;
  const half = tc * Math.sqrt(s2) * Math.sqrt(1 + 1 / n + (x0 - xbar) ** 2 / sxx);
  const projection = { horizon, xUnit, at: new Date(t0 + x0 * DAY).toISOString().slice(0, 10), value: yhat, low: yhat - half, high: yhat + half,
    caveat: 'Linear extrapolation of the supplied points with an interval that assumes independent residuals. It is not a forecast.' };

  const cautions = [];
  if (n < 10) cautions.push(`Only ${n} points: Mann–Kendall has low power below ~10 points, so "no significant trend" may just mean "not enough data".`);
  if (Math.sign(ols.slope) !== Math.sign(tsSlope) && tsSlope !== 0) cautions.push('OLS and Theil–Sen slopes disagree in sign — outliers or non-linearity are driving the fit.');
  if (ols.r2 < 0.3 && direction !== 'no-significant-trend') cautions.push('A monotonic trend was detected but a straight line explains little of the variation (low R²).');
  cautions.push('Time-series points are usually autocorrelated, which makes the p-value optimistic. Treat it as a guide.');

  return { status: 'ok', n, xUnit, from: clean[0].t, to: clean[n - 1].t, direction, percentChange,
    ols, theilSen: { slope: tsSlope, intercept: tsIntercept },
    mannKendall: { S, z, p, tau, significantAt: 0.05 }, outliers, movingAverage: ma, projection, cautions,
    points: clean.map((pt, i) => ({ t: pt.t, x: x[i], v: pt.v, source: pt.source, note: pt.note })) };
}
