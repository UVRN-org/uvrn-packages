// Report renderer: every run yields text + a chart. Self-contained HTML with inline SVG (no dependencies),
// plus an optional Markdown report. Built on UVRN (Apache-2.0). See ../NOTICE.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = (n) => (n == null || !Number.isFinite(n) ? '–' : Number(n).toFixed(1));
const f3 = (n) => (n == null || !Number.isFinite(n) ? '–' : Number(n).toFixed(3));
const pc = (p, d = 0) => (p == null ? '–' : `${(p * 100).toFixed(d)}%`);
const trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const fmtNum = (n) => (Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : Number(n.toPrecision(4)).toString());

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, ticks };
}

const CSS = `
:root{--bg:#faf9f6;--fg:#1c1c1a;--muted:#66655f;--card:#fff;--line:#e3e0d6;--accent:#2457c5;--accent2:#7a4fd0;--ok:#25794a;--warn:#a96a00;--bad:#b3302f;--band:rgba(36,87,197,.16);--track:#ecebe4;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161614;--fg:#ecebe6;--muted:#a3a29a;--card:#1f1f1c;--line:#34332f;--accent:#7aa2ff;--accent2:#b79bff;--ok:#5cc58a;--warn:#e0a63c;--bad:#ff7a76;--band:rgba(122,162,255,.2);--track:#2b2a27;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#161614;--fg:#ecebe6;--muted:#a3a29a;--card:#1f1f1c;--line:#34332f;--accent:#7aa2ff;--accent2:#b79bff;--ok:#5cc58a;--warn:#e0a63c;--bad:#ff7a76;--band:rgba(122,162,255,.2);--track:#2b2a27;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:880px;margin:0 auto;padding:28px 16px 48px}
.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}h1{font-size:22px;line-height:1.3;margin:6px 0 10px;font-weight:650}
.lede{margin:0 0 18px;color:var(--fg)}.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid currentColor}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:14px 0}.card h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;font-weight:600}
.big{font-size:44px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}.row{display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
svg{display:block;width:100%;min-width:540px;height:auto}svg text{fill:var(--fg);font:12px system-ui,sans-serif}svg .m{fill:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.card{overflow-x:auto}a{color:var(--accent)}ul{margin:6px 0 0;padding-left:20px}.grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.mini{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.mini b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
footer{margin-top:22px;font-size:12px;color:var(--muted)}`;

const shell = (title, eyebrow, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main><div class="eyebrow">${esc(eyebrow)}</div>${body}<footer>UVRN-style analysis from the uvrn-skills plugin, built on UVRN (Apache-2.0). It is an observation about the evidence supplied, not a signed UVRN receipt, and not proof that a claim is true.</footer></main></body></html>`;
const bandClass = (s) => (s === 'STABLE' ? 'ok' : s === 'DRIFTING' ? 'warn' : 'bad');

// ───────────── FACT-CHECK ─────────────
function vscoreSvg(r) {
  const W = 760, H = 150, x0 = 20, x1 = W - 20, w = x1 - x0, th = { stable: { general: 75 } };
  const prof = { financial: [55, 80], research: [50, 75], news: [45, 70], general: [50, 75] }[r.profile] ?? [50, 75];
  const X = (v) => x0 + (v / 100) * w;
  const comps = [['Completeness', r.score.completeness], ['Parity', r.score.parity], ['Freshness', r.score.freshness]];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="V-Score ${f1(r.score.final)} out of 100, ${r.score.status}">`;
  s += `<rect x="${X(0)}" y="8" width="${X(prof[0]) - X(0)}" height="22" fill="var(--bad)" opacity=".22"/><rect x="${X(prof[0])}" y="8" width="${X(prof[1]) - X(prof[0])}" height="22" fill="var(--warn)" opacity=".22"/><rect x="${X(prof[1])}" y="8" width="${X(100) - X(prof[1])}" height="22" fill="var(--ok)" opacity=".22"/>`;
  s += `<text class="m" x="${X(prof[0] / 2)}" y="23" text-anchor="middle">CRITICAL</text><text class="m" x="${X((prof[0] + prof[1]) / 2)}" y="23" text-anchor="middle">DRIFTING</text><text class="m" x="${X((prof[1] + 100) / 2)}" y="23" text-anchor="middle">STABLE</text>`;
  s += `<rect x="${X(r.score.final) - 2}" y="4" width="4" height="30" rx="2" fill="var(--fg)"/><text x="${Math.min(Math.max(X(r.score.final), 30), W - 30)}" y="48" text-anchor="middle" font-weight="700">${f1(r.score.final)}</text>`;
  comps.forEach(([name, c], i) => {
    const y = 66 + i * 28;
    s += `<text x="${x0}" y="${y + 12}">${name}</text><rect x="130" y="${y}" width="360" height="16" rx="4" fill="var(--track)"/><rect x="130" y="${y}" width="${Math.max(0, 360 * c.raw / 100)}" height="16" rx="4" fill="var(--accent)"/>`;
    s += `<text x="504" y="${y + 12}" class="m">${f1(c.raw)} × ${Math.round(c.weight * 100)}% = ${f1(c.weighted)} pts</text>`;
  });
  return s + '</svg>';
}
function evidenceSvg(r) {
  const W = 760, numeric = r.basis.startsWith('numeric');
  if (numeric) {
    const rows = r.sources, vals = rows.map((x) => x.value), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1;
    const t = niceTicks(lo - pad, hi + pad, 5), X = (v) => 30 + ((v - t.lo) / (t.hi - t.lo)) * (W - 60), H = 40 + rows.length * 26 + 30;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Value reported by each retained source">`;
    t.ticks.forEach((v) => { s += `<line x1="${X(v)}" x2="${X(v)}" y1="14" y2="${H - 26}" stroke="var(--line)"/><text class="m" x="${X(v)}" y="${H - 8}" text-anchor="middle">${fmtNum(v)}</text>`; });
    const med = r.absoluteConsensusValue?.median;
    if (med != null) s += `<line x1="${X(med)}" x2="${X(med)}" y1="14" y2="${H - 26}" stroke="var(--accent2)" stroke-width="2" stroke-dasharray="5 4"/><text x="${X(med)}" y="10" text-anchor="middle" fill="var(--accent2)" style="fill:var(--accent2)">median ${fmtNum(med)}</text>`;
    rows.forEach((x, i) => { const y = 40 + i * 26, rad = 4 + (x.credibilityScore / 100) * 6;
      s += `<circle cx="${X(x.value)}" cy="${y}" r="${rad}" fill="var(--accent)" opacity=".85"><title>${esc(x.title)}: ${x.value} (credibility ${f1(x.credibilityScore)})</title></circle><text x="${X(x.value) + rad + 6}" y="${y + 4}">${esc(trunc(x.title, 34))}</text>`; });
    return s + '</svg><div class="muted" style="font-size:12px">Dot size = declared credibility. Dashed line = median of retained sources.</div>';
  }
  const cl = r.clusters, total = cl.reduce((a, c) => a + c.origins.length, 0), H = 30 + cl.length * 32;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Independent origins grouped by position">`;
  cl.forEach((c, i) => { const y = 10 + i * 32, w = (W - 360) * c.origins.length / total;
    s += `<text x="10" y="${y + 17}">${esc(trunc(c.key, 28))}</text><rect x="200" y="${y}" width="${Math.max(4, w)}" height="22" rx="4" fill="${i === 0 ? 'var(--accent)' : 'var(--accent2)'}" opacity=".85"/><text x="${206 + Math.max(4, w)}" y="${y + 16}" class="m">${c.origins.length} of ${total} origin${total === 1 ? '' : 's'}</text>`; });
  return s + '</svg>';
}
function checksSvg(c) {
  if (!c.total) return '<div class="muted">No self-checks were recorded for this run.</div>';
  const W = 760, seg = [['pass', c.pass, 'var(--ok)'], ['fail', c.fail, 'var(--bad)'], ['unresolved', c.unresolved, 'var(--warn)']];
  let x = 10, s = `<svg viewBox="0 0 ${W} 54" role="img" aria-label="Self-checks: ${c.pass} passed, ${c.fail} failed, ${c.unresolved} unresolved">`;
  seg.forEach(([n, v, col]) => { if (!v) return; const w = ((W - 20) * v) / c.total; s += `<rect x="${x}" y="6" width="${w}" height="24" fill="${col}" opacity=".85"/><text x="${x + w / 2}" y="22" text-anchor="middle" style="fill:#fff;font-weight:600">${v}</text>`; x += w; });
  s += `<text class="m" x="10" y="48">${c.pass} passed · ${c.fail} failed · ${c.unresolved} unresolved of ${c.total}</text></svg>`;
  return s;
}
function factcheckHtml(r) {
  const head = `<h1>${esc(r.claim)}</h1>`;
  if (r.status === 'invalid') return shell('Invalid input', 'Cross-reference', `${head}<div class="card"><h2>Input problems</h2><ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`);
  const warn = r.warnings.length ? `<div class="card"><h2>Notes on the evidence</h2><ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
  const selfCard = `<div class="card"><h2>Agent self-check (reported separately, not part of the score)</h2>${checksSvg(r.selfChecks)}${r.selfChecks.failed.length ? `<ul>${r.selfChecks.failed.map((c) => `<li class="bad"><b>Failed:</b> ${esc(c.question ?? c.id)}${c.note ? ' — ' + esc(c.note) : ''}</li>`).join('')}</ul>` : ''}${r.selfChecks.unresolvedList.length ? `<ul>${r.selfChecks.unresolvedList.map((c) => `<li class="warn"><b>Unresolved:</b> ${esc(c.question ?? c.id)}${c.note ? ' — ' + esc(c.note) : ''}</li>`).join('')}</ul>` : ''}</div>`;
  const table = (rows) => `<div class="card"><h2>Sources compared</h2><table><tr><th>Source</th><th>Origin</th><th>${r.basis.startsWith('numeric') ? 'Value' : 'Position'}</th><th class="n">Credibility</th><th class="n">Freshness</th></tr>${rows.map((x) => `<tr><td>${x.url ? `<a href="${esc(x.url)}">${esc(trunc(x.title, 48))}</a>` : esc(trunc(x.title, 48))}</td><td>${esc(trunc(x.originId, 34))}</td><td>${esc(x.value ?? x.assertion)}</td><td class="n">${f1(x.credibilityScore)}</td><td class="n">${x.timestampSource === 'declared' ? f1(x.recencyScore) : '<span class="muted">no date</span>'}</td></tr>`).join('')}</table></div>`;
  if (r.status === 'insufficient-independent-sources') {
    return shell(`Cross-reference: ${r.claim}`, 'Cross-reference · UVRN-style', `${head}<p class="lede"><span class="chip warn">INSUFFICIENT INDEPENDENT SOURCES</span></p><div class="card"><h2>No score produced</h2><p>${esc(r.insufficientIndependentSources.reason)}</p><p class="muted">This is an honest result, not a failure. Add independent sources (different origins, not reprints of one report) and run again. Nothing is guessed to fill the gap.</p></div>${selfCard}${warn}${table(r.sources)}`);
  }
  const m = r.measures, mini = (k, label) => `<div class="mini"><b>${label}</b>${esc(m[k].verdict)}<div class="muted" style="font-size:12px">confidence ${f3(m[k].confidence)}</div></div>`;
  const decay = r.decay ? `<p class="muted">Freshness decayed ${f1(r.decay.freshnessBefore)} → ${f1(r.decay.freshnessAfter)} (${esc(r.decay.curve)}, ${r.decay.ageHours}h). ${esc(r.decay.note)}</p>` : '';
  return shell(`Cross-reference: ${r.claim}`, `Cross-reference · ${r.profile} profile · evaluated ${r.evaluatedAt.slice(0, 10)}`,
    `${head}<p class="lede"><span class="chip ${bandClass(r.score.status)}">${r.score.status}</span> &nbsp;${esc(r.headline)}</p>${r.caution ? `<p class="bad"><b>${esc(r.caution)}</b></p>` : ''}
<div class="card"><h2>V-Score</h2><div class="row"><span class="big">${f1(r.score.final)}</span><span class="muted">Completeness 35% · Parity 35% · Freshness 30% — limiting factor: ${r.score.limitingFactor}</span></div>${vscoreSvg(r)}${decay}</div>
<div class="card"><h2>What the independent sources say</h2>${evidenceSvg(r)}</div>
${selfCard}
<div class="card"><h2>Relationship between sources</h2><div class="grid4">${mini('agree', 'Agree')}${mini('disagree', 'Disagree')}${mini('conflict', 'Conflict')}${mini('potential', 'Potential')}</div></div>
${warn}${table(r.sources)}`);
}

// ───────────── FORECAST ─────────────
function probSvg(r) {
  const W = 760;
  if (r.method === 'judgment' && r.status === 'ok') {
    const o = [...r.outcomes].sort((a, b) => b.p - a.p), H = 16 + o.length * 34;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Agent judgment allocation">`;
    o.forEach((x, i) => { const y = 8 + i * 34; s += `<text x="10" y="${y + 18}">${esc(trunc(x.id, 22))}</text><rect x="190" y="${y}" width="${W - 280}" height="24" rx="5" fill="var(--track)"/><rect x="190" y="${y}" width="${(W - 280) * x.p}" height="24" rx="5" fill="var(--accent2)"/><text x="${W - 80}" y="${y + 17}" font-weight="700">${pc(x.p, 1)}</text>`; });
    return s + '</svg>';
  }
  const X = (p) => 30 + p * (W - 60);
  let s = `<svg viewBox="0 0 ${W} 134" role="img" aria-label="Probability ${pc(r.p, 1)}${r.low != null ? `, range ${pc(r.low, 1)} to ${pc(r.high, 1)}` : ''}">`;
  for (let i = 0; i <= 10; i++) s += `<line x1="${X(i / 10)}" x2="${X(i / 10)}" y1="30" y2="74" stroke="var(--line)"/><text class="m" x="${X(i / 10)}" y="92" text-anchor="middle">${i * 10}%</text>`;
  s += `<rect x="${X(0)}" y="44" width="${X(1) - X(0)}" height="14" rx="7" fill="var(--track)"/>`;
  if (r.low != null) s += `<rect x="${X(r.low)}" y="40" width="${Math.max(3, X(r.high) - X(r.low))}" height="22" rx="6" fill="var(--band)" stroke="var(--accent)"/>`;
  const by = r.detail?.byMethod;
  if (by) {
    Object.values(by).forEach((v) => { s += `<line x1="${X(v)}" x2="${X(v)}" y1="64" y2="72" stroke="var(--muted)"/>`; });
    s += `<text class="m" x="${W / 2}" y="124" text-anchor="middle">de-vig methods (ticks): ${Object.entries(by).map(([k, v]) => `${k} ${pc(v, 1)}`).join(' · ')}</text>`;
  }
  s += `<circle cx="${X(r.p)}" cy="51" r="9" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/><text x="${Math.min(Math.max(X(r.p), 40), W - 40)}" y="22" text-anchor="middle" font-weight="700" style="font-size:14px">${pc(r.p, 1)}</text>`;
  return s + '</svg>';
}
function reliabilitySvg(t) {
  const S = 280, P = 52, X = (v) => P + v * (S - P - 10), Y = (v) => S - P + 10 - v * (S - P - 10);
  let s = `<svg viewBox="0 0 ${S} ${S}" style="max-width:300px" role="img" aria-label="Calibration: forecast probability versus observed frequency">`;
  s += `<rect x="${P}" y="10" width="${S - P - 10}" height="${S - P - 10}" fill="none" stroke="var(--line)"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
  [0, 0.5, 1].forEach((v) => { s += `<text class="m" x="${X(v)}" y="${S - 28}" text-anchor="middle">${v * 100}%</text><text class="m" x="${P - 6}" y="${Y(v) + 4}" text-anchor="end">${v * 100}%</text>`; });
  t.bins.filter((b) => b.count).forEach((b) => { s += `<circle cx="${X(b.meanForecast)}" cy="${Y(b.observedFrequency)}" r="${3 + Math.min(8, b.count)}" fill="var(--accent)" opacity=".8"><title>${b.count} forecasts: said ${pc(b.meanForecast)}, happened ${pc(b.observedFrequency)}</title></circle>`; });
  return s + `<text class="m" x="${(P + S) / 2}" y="${S - 4}" text-anchor="middle">forecast said</text><text class="m" transform="rotate(-90 12 ${S / 2 - 10})" x="12" y="${S / 2 - 10}" text-anchor="middle">happened</text></svg>`;
}
function forecastHtml(r) {
  const title = r.question?.text ?? 'Forecast';
  if (r.status === 'invalid') return shell('Invalid forecast input', 'Forecast', `<h1>${esc(title)}</h1><div class="card"><h2>Input problems</h2><ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`);
  const modeLabel = { market: 'MARKET-IMPLIED', baserate: 'BASE RATE', judgment: 'AGENT JUDGMENT' }[r.mode];
  const target = r.targetLabel ? ` for “${esc(r.targetLabel)}”` : '';
  let main;
  if (r.status === 'ok') {
    const bandTxt = r.low != null ? `range ${pc(r.low, 1)}–${pc(r.high, 1)} (${esc({ 'method-spread': 'spread across de-vig methods — not a confidence interval', 'bid-ask': 'exchange bid–ask', 'jeffreys-95': '95% Jeffreys interval' }[r.bandKind] ?? r.bandKind)})` : 'no interval — a judgment is not a measured rate';
    main = `<div class="card"><h2>Probability${target}</h2><div class="row">${r.mode === 'judgment' ? '' : `<span class="big">${pc(r.p, 1)}</span>`}<span class="muted">${bandTxt}</span></div>${probSvg(r)}</div>`;
  } else main = `<div class="card"><h2>No number produced</h2><p>Refused rather than guessed — no 50% placeholder.</p><ul>${r.refusals.map((x) => `<li><code>${esc(x.code)}</code> — ${esc(x.message)}</li>`).join('')}</ul></div>`;
  const d = r.detail ?? {};
  const basis = r.mode === 'market' ? `<li>Venue: ${esc(d.venue || 'unspecified')} (${esc(d.kind)}). ${esc(d.priceLabel ?? '')}</li>${d.overround != null ? `<li>Bookmaker overround: ${pc(d.overround, 1)}; de-vig default: power method.</li>` : ''}<li>A market price is what traders/books imply, not a UVRN estimate; no bias correction applied.</li>`
    : r.mode === 'baserate' ? `<li>Reference class: ${esc(d.referenceClass ?? '')}</li><li>${d.x ?? '–'} of ${d.n ?? '–'} comparable cases had the outcome (Jeffreys interval, posterior-mean point estimate).</li><li>${esc(d.note ?? '')}</li>`
    : `<li>${esc(d.label ?? '')}; basis: <b>${esc(d.basis ?? '')}</b> (${d.evidenceCount ?? 0} cited source(s)).</li><li>Rationale: ${esc(d.rationale ?? '')}</li><li>Counterarguments: ${(d.counterarguments ?? []).map(esc).join('; ')}</li>${d.uncertainty ? `<li>What would change this view: ${esc(d.uncertainty)}</li>` : ''}${(d.assumptions ?? []).length ? `<li>Assumptions: ${d.assumptions.map(esc).join('; ')}</li>` : ''}`;
  const trackCard = r.track && r.track.n ? `<div class="card"><h2>Track record of this forecaster</h2><div class="row"><span class="big">${f3(r.track.meanBrier)}</span><span class="muted">mean Brier over ${r.track.n} resolved forecasts (lower is better; always saying 50% scores 0.250; skill vs that baseline ${pc(r.track.skill, 0)})</span></div>${reliabilitySvg(r.track)}<div class="muted" style="font-size:12px">Dots on the dashed line = well calibrated. Dot size = number of forecasts in the bin. Few forecasts means a noisy picture.</div></div>` : '';
  return shell(`Forecast: ${title}`, `Forecast · ${modeLabel} · as of ${r.asOf} · resolves by ${r.question.resolveBy}`,
    `<h1>${esc(title)}</h1><p class="lede"><span class="chip ${r.status === 'ok' ? 'ok' : 'warn'}">${modeLabel}</span> &nbsp;Resolution rule: ${esc(r.question.resolutionRule)}</p>${main}<div class="card"><h2>Basis</h2><ul>${basis}</ul></div>${trackCard}<div class="card"><h2>Read this carefully</h2><ul><li>A probability is an estimate under stated information as of ${esc(r.asOf)}; it is not a guarantee, and one outcome cannot confirm or refute it.</li><li>${esc(r.notAReceipt)}</li><li>Calibration is judged over many forecasts (Brier score, reliability), not one.</li></ul></div>`);
}

// ───────────── TREND ─────────────
function trendSvg(r) {
  const W = 760, H = 330, L = 56, R = 20, T = 20, B = 44, pts = r.points;
  const xs = pts.map((p) => p.x), pj = r.projection, xMax = Math.max(...xs) + pj.horizon, xMin = Math.min(...xs);
  const ys = [...pts.map((p) => p.v), pj.low, pj.high], t = niceTicks(Math.min(...ys), Math.max(...ys), 5);
  const X = (v) => L + ((v - xMin) / (xMax - xMin || 1)) * (W - L - R), Y = (v) => T + (1 - (v - t.lo) / (t.hi - t.lo)) * (H - T - B);
  const t0 = Date.parse(r.from), dateAt = (x) => new Date((Number.isFinite(t0) ? t0 : 0) + x * 86400000).toISOString().slice(0, 10);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend: ${esc(r.direction)}">`;
  t.ticks.forEach((v) => { s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text class="m" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`; });
  [0, 0.5, 1].forEach((f) => { const x = xMin + f * (xMax - xMin); s += `<text class="m" x="${X(x)}" y="${H - 20}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${dateAt(x)}</text>`; });
  const xe = xs[xs.length - 1], xp = xe + pj.horizon, ln = (m, b, a, c) => `<line x1="${X(a)}" y1="${Y(b + m * a)}" x2="${X(c)}" y2="${Y(b + m * c)}"`;
  s += `<polygon points="${X(xe)},${Y(r.ols.intercept + r.ols.slope * xe)} ${X(xp)},${Y(pj.high)} ${X(xp)},${Y(pj.low)}" fill="var(--band)"/>`;
  s += `${ln(r.ols.slope, r.ols.intercept, xMin, xp)} stroke="var(--accent)" stroke-width="2" stroke-dasharray="${''}"/>`;
  s += `${ln(r.theilSen.slope, r.theilSen.intercept, xMin, xe)} stroke="var(--accent2)" stroke-width="2" stroke-dasharray="6 4"/>`;
  s += `<polyline fill="none" stroke="var(--muted)" stroke-width="1" points="${pts.map((p) => `${X(p.x)},${Y(p.v)}`).join(' ')}"/>`;
  pts.forEach((p, i) => { const out = r.outliers.some((o) => o.index === i); s += `<circle cx="${X(p.x)}" cy="${Y(p.v)}" r="${out ? 6 : 4}" fill="${out ? 'var(--bad)' : 'var(--fg)'}"><title>${esc(p.t)}: ${p.v}${out ? ' (outlier)' : ''}</title></circle>`; });
  s += `<text class="m" x="${L}" y="12">— OLS fit   - - Theil–Sen (robust)   shaded = 95% projection interval   red = outlier</text>`;
  return s + '</svg>';
}
function trendHtml(r) {
  const title = r.title ?? 'Trend analysis';
  if (r.status === 'invalid') return shell('Invalid trend input', 'Trend', `<h1>${esc(title)}</h1><ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`);
  if (r.status === 'insufficient-data') return shell(`Trend: ${title}`, 'Trend · UVRN-style', `<h1>${esc(title)}</h1><p class="lede"><span class="chip warn">INSUFFICIENT DATA</span></p><div class="card"><h2>No trend reported</h2><p>${esc(r.reason)}</p></div>`);
  const cls = r.direction === 'no-significant-trend' ? 'warn' : 'ok', u = r.xUnit;
  return shell(`Trend: ${title}`, `Trend · ${r.n} points · ${String(r.from).slice(0, 10)} → ${String(r.to).slice(0, 10)}`,
    `<h1>${esc(title)}</h1><p class="lede"><span class="chip ${cls}">${esc(r.direction.toUpperCase())}</span> &nbsp;Theil–Sen slope ${fmtNum(r.theilSen.slope)} per ${u}${r.percentChange != null ? `; first → last change ${r.percentChange.toFixed(1)}%` : ''}.</p>
<div class="card"><h2>Series, fits and projection</h2>${trendSvg(r)}</div>
<div class="card"><h2>Statistics</h2><table><tr><th>Measure</th><th class="n">Value</th><th>Meaning</th></tr>
<tr><td>OLS slope</td><td class="n">${fmtNum(r.ols.slope)} / ${u}</td><td>95% CI ${fmtNum(r.ols.ci95[0])} to ${fmtNum(r.ols.ci95[1])}; R² ${f3(r.ols.r2)}</td></tr>
<tr><td>Theil–Sen slope</td><td class="n">${fmtNum(r.theilSen.slope)} / ${u}</td><td>median of pairwise slopes — resistant to outliers</td></tr>
<tr><td>Mann–Kendall</td><td class="n">p = ${r.mannKendall.p.toFixed(4)}</td><td>τ ${f3(r.mannKendall.tau)}, S ${r.mannKendall.S}; monotonic trend significant at 5%: ${r.mannKendall.p < 0.05 ? 'yes' : 'no'}</td></tr>
<tr><td>Projection (+${r.projection.horizon} ${u}s → ${r.projection.at})</td><td class="n">${fmtNum(r.projection.value)}</td><td>95% interval ${fmtNum(r.projection.low)} to ${fmtNum(r.projection.high)} — ${esc(r.projection.caveat)}</td></tr>
<tr><td>Outliers</td><td class="n">${r.outliers.length}</td><td>${r.outliers.map((o) => `${esc(o.t)} (${o.v})`).join(', ') || 'none flagged (robust z > 3.5)'}</td></tr></table></div>
<div class="card"><h2>Cautions</h2><ul>${r.cautions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`);
}

export function renderHtml(r) {
  if (r.kind === 'factcheck') return factcheckHtml(r);
  if (r.kind === 'forecast' || r.specVersion?.includes('forecast')) return forecastHtml(r);
  if (r.kind === 'trend') return trendHtml(r);
  throw new Error(`cannot render result of kind ${r.kind}`);
}

// ───────────── MARKDOWN ─────────────
export function renderMarkdown(r) {
  const L = [];
  if (r.kind === 'factcheck') {
    L.push(`# Cross-reference: ${r.claim}`, '');
    if (r.status === 'invalid') return [...L, ...r.errors.map((e) => `- ${e}`)].join('\n');
    if (r.status === 'insufficient-independent-sources') L.push(`**Insufficient independent sources.** ${r.insufficientIndependentSources.reason}`, '', 'No score was produced; nothing was guessed to fill the gap.');
    else {
      L.push(`**${r.score.status}** — ${r.headline}`, '', `- V-Score: **${f1(r.score.final)}** (${r.profile} profile; limiting factor: ${r.score.limitingFactor})`,
        `- Completeness ${f1(r.score.completeness.raw)} · Parity ${f1(r.score.parity.raw)} · Freshness ${f1(r.score.freshness.raw)} (weights 35/35/30)`,
        `- Measurements: agree=${r.measures.agree.verdict}, disagree=${r.measures.disagree.verdict}, conflict=${r.measures.conflict.verdict}, potential=${r.measures.potential.verdict}`);
      if (r.decay) L.push(`- Freshness decay (${r.decay.curve}): ${f1(r.decay.freshnessBefore)} → ${f1(r.decay.freshnessAfter)}`);
      if (r.caution) L.push('', `> **${r.caution}**`);
    }
    const c = r.selfChecks; L.push('', '## Agent self-check (not part of the score)', c.total ? `${c.pass} passed · ${c.fail} failed · ${c.unresolved} unresolved of ${c.total}` : 'No self-checks recorded.');
    c.failed.forEach((x) => L.push(`- FAILED: ${x.question ?? x.id}${x.note ? ' — ' + x.note : ''}`)); c.unresolvedList.forEach((x) => L.push(`- UNRESOLVED: ${x.question ?? x.id}${x.note ? ' — ' + x.note : ''}`));
    L.push('', '## Sources compared', '', '| Source | Origin | Value / position | Credibility | Freshness |', '|---|---|---|---|---|');
    r.sources.forEach((x) => L.push(`| ${x.url ? `[${x.title}](${x.url})` : x.title} | ${x.originId} | ${x.value ?? x.assertion} | ${f1(x.credibilityScore)} | ${x.timestampSource === 'declared' ? f1(x.recencyScore) : 'no date'} |`));
    if (r.warnings.length) L.push('', '## Notes on the evidence', ...r.warnings.map((w) => `- ${w}`));
    L.push('', `_${r.notAReceipt}_`);
  } else if (r.kind === 'forecast' || r.specVersion?.includes('forecast')) {
    L.push(`# Forecast: ${r.question?.text ?? ''}`, '');
    if (r.status === 'invalid') return [...L, ...r.errors.map((e) => `- ${e}`)].join('\n');
    L.push(`- Mode: **${r.mode}** · as of ${r.asOf} · resolves by ${r.question.resolveBy}`, `- Resolution rule: ${r.question.resolutionRule}`);
    if (r.status === 'ok') { L.push(`- Probability${r.targetLabel ? ` (“${r.targetLabel}”)` : ''}: **${pc(r.p, 1)}**${r.low != null ? ` (range ${pc(r.low, 1)}–${pc(r.high, 1)}; ${r.bandKind})` : ''}`); if (r.outcomes) r.outcomes.forEach((o) => L.push(`  - ${o.id}: ${pc(o.p, 1)}`)); }
    else L.push('- **No number produced** (refused, not guessed):', ...r.refusals.map((x) => `  - \`${x.code}\` — ${x.message}`));
    if (r.track?.n) L.push('', `Track record: mean Brier ${f3(r.track.meanBrier)} over ${r.track.n} resolved forecasts (50%-always baseline 0.250).`);
    L.push('', `_${r.notAReceipt}_`);
  } else if (r.kind === 'trend') {
    L.push(`# Trend: ${r.title ?? ''}`, '');
    if (r.status !== 'ok') return [...L, r.reason ?? (r.errors ?? []).join('; ')].join('\n');
    L.push(`**${r.direction}** over ${r.n} points (${String(r.from).slice(0, 10)} → ${String(r.to).slice(0, 10)}).`, '',
      `- Theil–Sen slope: ${fmtNum(r.theilSen.slope)} per ${r.xUnit}`, `- OLS slope: ${fmtNum(r.ols.slope)} per ${r.xUnit} (95% CI ${fmtNum(r.ols.ci95[0])} to ${fmtNum(r.ols.ci95[1])}, R² ${f3(r.ols.r2)})`,
      `- Mann–Kendall: p = ${r.mannKendall.p.toFixed(4)}, τ = ${f3(r.mannKendall.tau)}`, `- Projection to ${r.projection.at}: ${fmtNum(r.projection.value)} (95% ${fmtNum(r.projection.low)} to ${fmtNum(r.projection.high)}) — ${r.projection.caveat}`,
      '', '## Cautions', ...r.cautions.map((c) => `- ${c}`));
  }
  return L.join('\n') + '\n';
}
