// Fidelity tests: the ports must reproduce the real UVRN packages.
//  1. Golden vectors in ../../SPEC/vectors (always run).
//  2. Differential tests against the built @uvrn/* dist (skipped when dist is absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { impliedProbability } from '../lib/odds.mjs';
import { jeffreysInterval } from '../lib/beta.mjs';
import { marketForecast, baseRateForecast } from '../lib/forecast.mjs';
import { analyzeSources } from '../lib/consensus.mjs';
import { scoreBreakdown, SCORE_PROFILES, applyDecay } from '../lib/score.mjs';
import { agree, disagree, conflict, potential } from '../lib/measure.mjs';
import { brierScore, brierMultiScore, reliabilityBins } from '../lib/track.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
const vec = (f) => JSON.parse(readFileSync(path.join(repo, 'SPEC/vectors', f), 'utf8'));
const dist = (pkg) => { const p = path.join(repo, pkg, 'dist/index.js'); return existsSync(p) ? require(p) : null; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;

// deterministic PRNG so differential cases are reproducible
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

test('golden: impliedProbability (probability-v1 unit block)', () => {
  for (const c of vec('probability-v1.json').unit.impliedProbability) {
    const got = impliedProbability(c.odds);
    assert.equal(got === null ? null : r6(got), c.expected);
  }
});
test('golden: Jeffreys interval (probability-v1 unit block)', () => {
  for (const c of vec('probability-v1.json').unit.jeffreys) {
    const j = jeffreysInterval(c.x, c.n);
    assert.equal(r6(j.p), c.p); assert.equal(r6(j.low), c.low); assert.equal(r6(j.high), c.high);
  }
});
test('golden: market + base-rate cases (probability-v1 vectors)', () => {
  let checked = 0;
  for (const c of vec('probability-v1.json').cases) {
    const { market, asOf, baseRate } = c.input;
    const asOfAt = asOf?.at;
    if (market && !baseRate && market.kind) {
      const m = { ...market, outcomes: market.outcomes.map((o) => ({ ...o, ...(o.exchange ? o.exchange : {}) })) };
      const exchangeOutcomes = market.kind === 'exchange';
      const mm = exchangeOutcomes ? { ...market, outcomes: market.outcomes.map((o) => ({ label: o.label, quotedAt: o.quotedAt, bid: o.bid ?? o.exchange?.bid, ask: o.ask ?? o.exchange?.ask, depthUsd: o.depthUsd ?? o.exchange?.depthUsd })) } : m;
      const r = marketForecast(mm, asOfAt);
      if (c.expected.method === 'market') {
        assert.equal(r.status, 'ok', `${c.id}: ${JSON.stringify(r)}`);
        assert.equal(r.p, c.expected.p, `${c.id} p`); assert.equal(r.low, c.expected.low, `${c.id} low`); assert.equal(r.high, c.expected.high, `${c.id} high`);
        checked += 1;
      } else if (c.expected.refusalCodes.length && !baseRate) {
        assert.ok(r.refusals.some((x) => c.expected.refusalCodes.includes(x.code)), `${c.id} refusal`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 4, `only ${checked} market vectors exercised`);
});

const consensusPkg = dist('uvrn-consensus');
const scorePkg = dist('uvrn-score');
const measurePkg = dist('uvrn-measure');
const driftPkg = dist('uvrn-drift');
const trackPkg = dist('uvrn-track-record');

test('differential: @uvrn/consensus stats + components', { skip: !consensusPkg }, () => {
  const rand = rng(7); let compared = 0, deviations = 0, refusedBoth = 0;
  for (let t = 0; t < 200; t++) {
    const n = 2 + Math.floor(rand() * 7), fetchedAt = '2026-10-18T12:00:00.000Z';
    const sources = Array.from({ length: n }, (_, i) => {
      const base = 100 + Math.floor(rand() * 3) * 10;
      const s = { title: `s${i}`, url: `https://ex.org/${t}/${Math.floor(rand() * 5)}`, snippet: 'x',
        credibility: rand() < 0.2 ? undefined : (rand() < 0.5 ? rand() : Math.floor(rand() * 100)),
        evidenceScore: rand() < 0.15 ? undefined : base + (rand() < 0.3 ? rand() * 0.5 : 0),
        publishedAt: new Date(Date.parse(fetchedAt) - Math.floor(rand() * 40) * 3600e3).toISOString() };
      if (rand() < 0.6) s.measuredAt = new Date(Date.parse(fetchedAt) - Math.floor(rand() * 45) * 86400e3).toISOString();
      return s;
    });
    const engine = new consensusPkg.ConsensusEngine({ sources: { sources, fetchedAt, query: 'q' } });
    const res = engine.buildConsensusResult('claim');
    const mine = analyzeSources(sources.map((s, i) => ({ ...s, id: `s${i}`, value: s.evidenceScore })), { fetchedAt });
    // Documented deviation: the port gates on distinct ORIGINS (≥2), the package on retained value-distinct sources (≥2).
    if ('insufficientIndependentSources' in res) {
      if (mine.insufficientIndependentSources) { refusedBoth += 1; continue; }
      assert.ok(mine.distinctOriginCount >= 2 && mine.retainedCount < 2, `case ${t}: package refused but port did not, outside the documented deviation`);
      deviations += 1; continue;
    }
    if (mine.insufficientIndependentSources) { // stricter by design: one origin is one voice, however many documents it has
      assert.ok(mine.distinctOriginCount < 2, `case ${t}: port refused where the package did not, outside the documented deviation`);
      deviations += 1; continue;
    }
    compared += 1;
    for (const k of ['completeness', 'parity', 'freshness']) assert.ok(Math.abs(res.components[k] - mine.components[k]) < 1e-9, `case ${t} ${k}: ${res.components[k]} vs ${mine.components[k]}`);
    assert.equal(res.stats.sourceCount, mine.stats.sourceCount, `case ${t} sourceCount`);
    assert.ok(Math.abs(res.stats.weightedConsensusScore - mine.stats.weightedConsensusScore) < 1e-9, `case ${t} weighted`);
  }
  assert.ok(compared >= 100, `only ${compared} cases compared (deviations ${deviations}, both refused ${refusedBoth})`);
});

test('differential: @uvrn/score ScoreBreakdown', { skip: !scorePkg }, () => {
  const rand = rng(11);
  for (const profile of Object.keys(SCORE_PROFILES)) for (let t = 0; t < 100; t++) {
    const comp = { completeness: r6(rand() * 100), parity: r6(rand() * 100), freshness: r6(rand() * 100) };
    const pkg = new scorePkg.ScoreBreakdown(comp, scorePkg.SCORE_PROFILES[profile]);
    const mine = scoreBreakdown(comp, profile);
    assert.equal(mine.final, pkg.final); assert.equal(mine.completeness.weighted, pkg.completeness.weighted);
    assert.equal(mine.parity.weighted, pkg.parity.weighted); assert.equal(mine.freshness.weighted, pkg.freshness.weighted);
    assert.ok(pkg.explanation.includes(`Consensus is ${mine.status}.`));
  }
});

test('differential: @uvrn/measure agree/disagree/conflict/potential', { skip: !measurePkg }, () => {
  const rand = rng(23);
  const get = (type) => (measurePkg.starterMeasurements ?? measurePkg.STARTER_MEASUREMENTS ?? []).find?.((m) => m.type === type) ?? measurePkg[`${type}Measurement`];
  const impl = { agree: [get('agree'), agree], disagree: [get('disagree'), disagree], conflict: [get('conflict'), conflict], potential: [get('potential'), potential] };
  for (const [k, [pkg]] of Object.entries(impl)) assert.ok(pkg?.evaluate, `package export for ${k}`);
  const strip = (r) => ({ type: r.type, verdict: r.verdict, confidence: r1(r.confidence), explanation: r.explanation, evidenceRefs: r.evidenceRefs });
  const r1 = (x) => Math.round(x * 1e12) / 1e12;
  for (let t = 0; t < 150; t++) {
    const n = Math.floor(rand() * 5);
    const kinds = ['numeric', 'boolean', 'categorical', 'range'];
    const sources = Array.from({ length: n }, (_, i) => {
      const kind = kinds[Math.floor(rand() * 4)];
      const s = { id: `s${i}`, kind, label: `L${i}` };
      if (kind === 'numeric') s.value = Math.floor(rand() * 200) / 10 * (rand() < 0.1 ? 0 : 1);
      if (kind === 'boolean' || kind === 'categorical') s.assertion = ['yes', 'no', 'Yes ', 'maybe'][Math.floor(rand() * 4)];
      if (kind === 'range') { const a = Math.floor(rand() * 10); s.range = { min: a, max: a + Math.floor(rand() * 5) }; }
      if (rand() < 0.3) s.attributes = { field: rand() < 0.5 ? 'a' : 'b' };
      return s;
    });
    const hist = rand() < 0.7 ? Array.from({ length: 2 + Math.floor(rand() * 5) }, () => Math.floor(rand() * 100) / 100).sort(() => rand() - 0.5) : undefined;
    const context = { ...(hist ? { history: rand() < 0.5 ? hist.slice().sort((a, b) => a - b) : hist } : {}), ...(rand() < 0.2 ? { agreeThreshold: 0.8 } : {}) };
    const input = { claim: 'c', sources, context };
    for (const [k, [pkg, port]] of Object.entries(impl)) assert.deepEqual(strip(port(input)), strip(pkg.evaluate(input)), `case ${t} ${k}`);
  }
});

test('differential: @uvrn/drift decay curves', { skip: !driftPkg }, () => {
  const fn = driftPkg.applyDecay ?? require(path.join(repo, 'uvrn-drift/dist/curves/index.js')).applyDecay;
  const rand = rng(31);
  for (let t = 0; t < 200; t++) for (const curve of ['LINEAR', 'SIGMOID', 'EXPONENTIAL']) {
    const s = rand() * 100, h = rand() * 200, rate = curve === 'EXPONENTIAL' ? rand() * 0.1 : curve === 'SIGMOID' ? rand() * 96 : rand();
    assert.equal(applyDecay(curve, s, h, rate), fn(curve, s, h, rate));
  }
});

test('differential: @uvrn/track-record Brier + reliability bins', { skip: !trackPkg }, () => {
  const rand = rng(41);
  for (let t = 0; t < 100; t++) {
    const p = rand(), o = rand() < 0.5 ? 0 : 1;
    assert.equal(brierScore(p, o), trackPkg.brierScore(p, o));
    const raw = [rand(), rand(), rand()], tot = raw.reduce((a, b) => a + b, 0), dist3 = raw.map((v) => v / tot);
    const idx = Math.floor(rand() * 3);
    assert.equal(brierMultiScore(dist3, idx), trackPkg.brierMultiScore(dist3, idx));
  }
  const res = Array.from({ length: 60 }, () => { const p = rand(); return { forecastP: p, outcome: rand() < p ? 1 : 0 }; });
  const pk = trackPkg.reliabilityBins(res.map((r) => ({ scoringRule: 'brier', forecastP: r.forecastP, outcome: r.outcome })), 10);
  assert.deepEqual(reliabilityBins(res, 10), pk);
});
