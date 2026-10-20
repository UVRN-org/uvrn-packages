// Port of @uvrn/measure starter measurements: agree, disagree, conflict, potential.
// Verdicts are observations about the relationship between sources — never proofs.
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
const num = (ctx, k, d) => (typeof ctx?.[k] === 'number' && Number.isFinite(ctx[k]) ? ctx[k] : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const norm = (s) => String(s ?? '').trim().toLowerCase();
const numericSources = (i) => i.sources.filter((s) => typeof s.value === 'number' && Number.isFinite(s.value));
const field = (s) => { const f = s.attributes?.field ?? s.attributes?.key ?? s.attributes?.metric; return typeof f === 'string' && f ? f : 'default'; };
function numericAgreement(i) {
  const src = numericSources(i); if (src.length < 2) return undefined;
  const v = src.map((s) => s.value), mn = Math.min(...v), mx = Math.max(...v);
  const mid = (Math.abs(mn) + Math.abs(mx)) / 2, spread = mid === 0 ? 0 : Math.abs(mx - mn) / mid;
  return { score: Math.max(0, Math.min(1, 1 - spread)), spread, refs: src.map((s) => s.id) };
}
function assertionAgreement(i) {
  const src = i.sources.filter((s) => typeof s.assertion === 'string' && s.assertion.length > 0); if (src.length < 2) return undefined;
  const first = norm(src[0].assertion), all = src.every((s) => norm(s.assertion) === first);
  return { score: all ? 1 : 0, spread: all ? 0 : 1, refs: src.map((s) => s.id) };
}
const bestAgreement = (i) => numericAgreement(i) ?? assertionAgreement(i);

export function agree(input) {
  const a = bestAgreement(input), refs = input.sources.map((s) => s.id);
  if (!a) return { type: 'agree', verdict: 'insufficient-data', confidence: 0, explanation: `Agree requires at least two comparable evidence sources; received ${input.sources.length} usable.`, evidenceRefs: refs };
  const t = num(input.context, 'agreeThreshold', 0.9), pass = a.score >= t;
  return { type: 'agree', verdict: pass ? 'agree' : 'no-agreement', confidence: a.score,
    explanation: pass ? `Sources converge with agreement score ${a.score.toFixed(3)} at threshold ${t}.` : `Sources do not reach agreement: score ${a.score.toFixed(3)} is below threshold ${t}.`, evidenceRefs: a.refs };
}
export function disagree(input) {
  const n = numericAgreement(input);
  if (!n) return { type: 'disagree', verdict: 'insufficient-data', confidence: 0, explanation: `Disagree requires at least two numeric evidence values; received ${numericSources(input).length}.`, evidenceRefs: input.sources.map((s) => s.id) };
  const t = num(input.context, 'divergenceThreshold', 0.1), d = n.spread > t;
  return { type: 'disagree', verdict: d ? 'disagree' : 'none', confidence: d ? Math.min(1, n.spread) : 1 - n.spread,
    explanation: d ? `Numeric sources diverge by ${n.spread.toFixed(3)}, above threshold ${t}.` : `Numeric spread ${n.spread.toFixed(3)} does not exceed disagreement threshold ${t}.`, evidenceRefs: n.refs };
}
const usableConflict = (s) => ((s.kind === 'boolean' || s.kind === 'categorical') && typeof s.assertion === 'string' && s.assertion.length > 0) || (s.kind === 'range' && s.range !== undefined);
export function conflict(input) {
  const usable = input.sources.filter(usableConflict);
  if (usable.length < 2) return { type: 'conflict', verdict: 'insufficient-data', confidence: 0, explanation: `Conflict requires at least two categorical, boolean, or range assertions; received ${usable.length}.`, evidenceRefs: input.sources.map((s) => s.id) };
  const tol = num(input.context, 'conflictRangeTolerance', 0), S = input.sources;
  for (let l = 0; l < S.length; l++) for (let r = l + 1; r < S.length; r++) {
    const L = S[l], R = S[r]; if (field(L) !== field(R)) continue;
    const lk = L.kind === 'boolean' || L.kind === 'categorical', rk = R.kind === 'boolean' || R.kind === 'categorical';
    if (lk && rk && L.assertion && R.assertion && norm(L.assertion) !== norm(R.assertion))
      return { type: 'conflict', verdict: 'conflict', confidence: 1, explanation: `Conflict: ${L.label ?? L.id} and ${R.label ?? R.id} assert mutually exclusive assertions "${L.assertion}" and "${R.assertion}".`, evidenceRefs: [L.id, R.id] };
    if (L.kind === 'range' && R.kind === 'range' && L.range && R.range && (L.range.max + tol < R.range.min || R.range.max + tol < L.range.min))
      return { type: 'conflict', verdict: 'conflict', confidence: 1, explanation: `Conflict: ${L.label ?? L.id} and ${R.label ?? R.id} assert mutually exclusive ranges ${L.range.min}-${L.range.max} and ${R.range.min}-${R.range.max}.`, evidenceRefs: [L.id, R.id] };
  }
  return { type: 'conflict', verdict: 'none', confidence: 0, explanation: 'No mutually exclusive categorical, boolean, or disjoint-range assertions were found.', evidenceRefs: input.sources.map((s) => s.id) };
}
const history = (i) => { const v = i.context?.history ?? i.context?.agreementHistory; if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? { score: x } : x && typeof x === 'object' && Number.isFinite(x.score) ? { score: x.score } : undefined)).filter(Boolean); };
export function potential(input) {
  const h = history(input), minObs = Math.max(1, Math.floor(num(input.context, 'minObservations', 3))), win = Math.max(2, Math.floor(num(input.context, 'windowSize', 3)));
  const refs = input.sources.map((s) => s.id);
  if (h.length < minObs) return { type: 'potential', verdict: 'insufficient-data', confidence: 0, explanation: `Potential requires at least ${minObs} observations; received ${h.length}.`, evidenceRefs: refs };
  const thr = num(input.context, 'agreeThreshold', 0.9), scores = h.map((x) => x.score), w = scores.slice(-win), cur = scores[scores.length - 1];
  const rising = w.length >= 2 && w.every((v, k) => k === 0 || v >= w[k - 1]) && w[w.length - 1] > w[0];
  if (rising && cur < thr) {
    const sample = Math.min(1, h.length / (2 * minObs)), strength = clamp((w[w.length - 1] - w[0]) / Math.max(0.05, 1 - w[0]), 0, 1);
    const conf = clamp(cur * (0.5 * sample + 0.5 * strength), 0, 1), floor = num(input.context, 'confidenceFloor', 0.25);
    if (conf < floor) return { type: 'potential', verdict: 'insufficient-data', confidence: conf, explanation: `Early signal detected but confidence ${conf.toFixed(3)} is below the ${floor} floor; reported as insufficient data rather than overstated.`, evidenceRefs: refs };
    return { type: 'potential', verdict: 'potential', confidence: conf, explanation: `Agreement is rising across the last ${w.length} observations but remains below threshold ${thr}.`, evidenceRefs: refs };
  }
  return { type: 'potential', verdict: 'none', confidence: Math.max(0, 1 - cur), explanation: `Potential not detected: rising=${rising}, current=${cur.toFixed(3)}, threshold=${thr}.`, evidenceRefs: refs };
}
export const measureAll = (input) => ({ agree: agree(input), disagree: disagree(input), conflict: conflict(input), potential: potential(input) });
