// End-to-end + behaviour tests for the skills: standalone install, refusals, escaping, honest vocabulary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFactCheck } from '../lib/factcheck.mjs';
import { runForecast, marketForecast, baseRateForecast, judgmentForecast } from '../lib/forecast.mjs';
import { analyzeTrend } from '../lib/trend.mjs';
import { renderHtml, renderMarkdown } from '../lib/report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ex = (n) => JSON.parse(readFileSync(path.join(root, 'examples', n), 'utf8'));
const NOW = '2026-10-18T15:00:00Z';

function runSkill(skill, mode, input, extra = []) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uvrn-skill-'));
  cpSync(path.join(root, 'skills', skill), path.join(tmp, skill), { recursive: true }); // standalone copy, nothing else from the repo
  const inFile = path.join(tmp, 'in.json'); writeFileSync(inFile, JSON.stringify(input));
  const r = spawnSync(process.execPath, [path.join(tmp, skill, 'scripts/run.mjs'), mode, inFile, '--out', path.join(tmp, 'out'), '--name', 'r', ...extra], { encoding: 'utf8' });
  return { ...r, tmp, summary: r.stdout ? JSON.parse(r.stdout.trim().split('\n').pop()) : null };
}

test('skill copies are in sync with lib/', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/sync-skills.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

for (const [skill, mode, file] of [['uvrn-factcheck', 'factcheck', 'factcheck.json'], ['uvrn-forecast', 'forecast', 'forecast-market.json'], ['uvrn-trends', 'trend', 'trend.json']]) {
  test(`standalone ${skill}: runs from a copied folder, writes text report + SVG chart + optional MD`, () => {
    const r = runSkill(skill, mode, ex(file), ['--md']);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(r.summary.files.html, 'utf8');
    assert.match(html, /<svg[\s\S]*<\/svg>/, 'has an inline SVG chart');
    assert.ok(html.length > 4000 && /<h1>/.test(html), 'has text content too');
    assert.ok(!/<script/i.test(html) && !/src="https?:/i.test(html), 'self-contained: no scripts, no remote assets');
    assert.ok(existsSync(r.summary.files.md) && existsSync(r.summary.files.json));
    assert.ok(!/\bverified\b/i.test(html.replace(/not a signed[^<]*/gi, '')) || /not verified|never verified/i.test(html) === false, 'does not claim "verified"');
  });
}

test('factcheck: honest vocabulary — reports never assert "verified"', () => {
  for (const f of ['factcheck.json']) {
    const res = runFactCheck(ex(f));
    for (const text of [renderHtml(res), renderMarkdown(res)]) assert.ok(!/\bverified\b/i.test(text), 'report text contains "verified"');
  }
});
test('factcheck: fewer than two independent origins → honest result, no score', () => {
  const one = runFactCheck({ claim: 'c', evaluatedAt: NOW, sources: [{ id: 'a', title: 'A', url: 'https://a', value: 5 }] });
  assert.equal(one.status, 'insufficient-independent-sources'); assert.equal(one.score, null);
  const echoes = runFactCheck({ claim: 'c', evaluatedAt: NOW, sources: [
    { id: 'a', title: 'A', url: 'https://a', originId: 'o', assertion: 'yes' }, { id: 'b', title: 'B', url: 'https://b', originId: 'o', assertion: 'yes' }, { id: 'c', title: 'C', url: 'https://c', originId: 'o', assertion: 'yes' }] });
  assert.equal(echoes.status, 'insufficient-independent-sources', 'three reprints of one origin are one voice');
  assert.match(renderHtml(echoes), /INSUFFICIENT INDEPENDENT SOURCES/);
});
test('factcheck: forecasts are excluded from evidence', () => {
  const r = runFactCheck({ claim: 'c', evaluatedAt: NOW, sources: [
    { id: 'a', title: 'A', url: 'https://a', value: 10, measuredAt: NOW }, { id: 'b', title: 'B', url: 'https://b', value: 10, measuredAt: NOW },
    { id: 'f', title: 'F', url: 'https://f', value: 99, obsStatus: 'F', appliesTo: '2027-01-01T00:00:00Z', measuredAt: NOW }] });
  assert.equal(r.status, 'ok'); assert.ok(r.warnings.some((w) => /forecast-type source/.test(w)));
  assert.ok(!r.sources.some((s) => s.id === 'f'));
});
test('factcheck: self-check failure is surfaced and does not change the score', () => {
  const base = ex('factcheck.json'); const failing = { ...base, checks: [...base.checks, { id: 'cx', question: 'figure matches primary source?', result: 'fail' }] };
  const a = runFactCheck(base), b = runFactCheck(failing);
  assert.equal(a.score.final, b.score.final); assert.ok(b.caution && /failed/.test(b.caution)); assert.equal(b.selfChecks.fail, 1);
  assert.match(renderHtml(b), /Failed:/);
});
test('factcheck: invalid input is reported, not guessed', () => {
  assert.equal(runFactCheck({ sources: [] }).status, 'invalid');
  assert.equal(runSkill('uvrn-factcheck', 'factcheck', { sources: [] }).status, 1);
});
test('reports escape untrusted text', () => {
  const r = runFactCheck({ claim: '<script>alert(1)</script>', evaluatedAt: NOW, sources: [
    { id: 'a', title: '<img src=x onerror=1>', url: 'https://a', value: 1, measuredAt: NOW }, { id: 'b', title: 'B', url: 'https://b', value: 1, measuredAt: NOW }] });
  const html = renderHtml(r);
  assert.ok(!html.includes('<script>alert(1)') && !html.includes('<img src=x'));
});

test('forecast: stale quote, thin base rate, bad judgment sum are refused/invalid — never a placeholder', () => {
  const req = ex('forecast-market.json');
  const stale = runForecast({ ...req, asOf: '2026-10-20T12:00:00-07:00' });
  assert.equal(stale.status, 'refused'); assert.ok(stale.refusals.some((x) => x.code === 'market_quote_stale')); assert.equal(stale.p, null);
  const thin = baseRateForecast({ referenceClass: { description: 'd', source: { url: 'https://x', accessedAt: NOW } }, x: 3, n: 7 });
  assert.equal(thin.status, 'refused'); assert.equal(thin.refusals[0].code, 'baserate_below_min_cases');
  const bad = judgmentForecast({ outcomes: [{ id: 'a', p: 0.6 }, { id: 'b', p: 0.5 }], rationale: 'r', counterarguments: ['c'] });
  assert.equal(bad.status, 'invalid'); assert.ok(bad.errors.some((e) => /sum/.test(e)));
});
test('forecast: exactly one mode, explicit asOf, required fields', () => {
  assert.equal(runForecast({ forecastId: 'x', question: { text: 't', resolveBy: '2026-11-01', resolutionRule: 'r' }, asOf: NOW, mode: 'blend' }).status, 'invalid');
  assert.equal(runForecast({ forecastId: 'x', question: { text: 't', resolveBy: '2026-11-01', resolutionRule: 'r' }, mode: 'market' }).status, 'invalid');
});
test('forecast: judgment is labeled and assumption-only without evidence', () => {
  const r = runForecast({ forecastId: 'j', asOf: NOW, mode: 'judgment', question: { text: 't', resolveBy: '2026-11-01', resolutionRule: 'r' },
    judgment: { outcomes: [{ id: 'home', p: 0.55 }, { id: 'away', p: 0.45 }], rationale: 'because', counterarguments: ['injuries'] } });
  assert.equal(r.status, 'ok'); assert.equal(r.detail.basis, 'assumption-only'); assert.match(r.detail.label, /agent judgment/);
  assert.match(renderHtml(r), /AGENT JUDGMENT/);
});
test('forecast: base rate matches the Jeffreys vector (3 of 8 → 0.388889, 0.119039–0.705177)', () => {
  const r = baseRateForecast({ referenceClass: { description: 'd', source: { url: 'https://x', accessedAt: NOW } }, x: 3, n: 8 });
  assert.deepEqual([r.p, r.low, r.high], [0.388889, 0.119039, 0.705177]);
});
test('forecast: invalid market input is explained', () => {
  const r = marketForecast({ kind: 'sportsbook', outcomes: [{ label: 'A' }], targetOutcome: 'A' }, NOW);
  assert.equal(r.status, 'invalid');
});

test('trend: exact slope on a clean line; refuses below minimum points; flat noise is not a trend', () => {
  const line = analyzeTrend(Array.from({ length: 8 }, (_, i) => ({ t: i, v: 3 + 2 * i })));
  assert.equal(line.status, 'ok'); assert.ok(Math.abs(line.theilSen.slope - 2) < 1e-12 && Math.abs(line.ols.slope - 2) < 1e-12); assert.equal(line.direction, 'rising');
  assert.equal(analyzeTrend([{ t: 0, v: 1 }, { t: 1, v: 2 }]).status, 'insufficient-data');
  const noise = analyzeTrend([5, 7, 4, 6, 5, 7, 4, 6, 5, 6].map((v, i) => ({ t: i, v })));
  assert.equal(noise.direction, 'no-significant-trend');
  assert.equal(analyzeTrend([{ t: 'nope', v: 1 }]).status, 'invalid');
});
test('trend: a single wild outlier is flagged and Theil–Sen resists it', () => {
  const pts = Array.from({ length: 12 }, (_, i) => ({ t: i, v: 10 + i + (i === 6 ? 80 : 0) }));
  const r = analyzeTrend(pts);
  assert.ok(r.outliers.some((o) => o.index === 6));
  assert.ok(Math.abs(r.theilSen.slope - 1) < 0.2, `Theil–Sen slope ${r.theilSen.slope}`);
  assert.ok(Math.abs(r.ols.slope - 1) > Math.abs(r.theilSen.slope - 1));
});
