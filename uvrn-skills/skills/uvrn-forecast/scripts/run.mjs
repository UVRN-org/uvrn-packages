#!/usr/bin/env node
// uvrn-skills runner. Usage:
//   node run.mjs <factcheck|forecast|trend> <input.json | -> [--out DIR] [--md] [--name BASE]
// Writes <name>.json (result) and <name>.html (text + chart report); with --md also <name>.md.
// Prints one JSON line summarizing the run and the file paths. Zero dependencies (Node >= 18).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { runFactCheck } from '../lib/factcheck.mjs';
import { runForecast } from '../lib/forecast.mjs';
import { analyzeTrend } from '../lib/trend.mjs';
import { trackSummary } from '../lib/track.mjs';
import { renderHtml, renderMarkdown } from '../lib/report.mjs';

const args = process.argv.slice(2);
const mode = args[0], inputArg = args[1];
const flag = (n) => args.includes(n), opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!['factcheck', 'forecast', 'trend'].includes(mode) || !inputArg) {
  console.error('usage: run.mjs <factcheck|forecast|trend> <input.json|-> [--out DIR] [--md] [--name BASE]');
  process.exit(2);
}
const raw = inputArg === '-' ? readFileSync(0, 'utf8') : readFileSync(inputArg, 'utf8');
let input; try { input = JSON.parse(raw); } catch (e) { console.error(`input is not valid JSON: ${e.message}`); process.exit(2); }

let result;
if (mode === 'factcheck') result = runFactCheck(input);
else if (mode === 'forecast') {
  result = runForecast(input);
  result.kind = 'forecast';
  if (Array.isArray(input.track) && result.status !== 'invalid') result.track = trackSummary(input.track);
} else { result = { kind: 'trend', title: input.title, ...analyzeTrend(input.points, input.options) }; }
if (!result.kind) result.kind = mode;

const out = path.resolve(opt('--out', 'uvrn-out'));
mkdirSync(out, { recursive: true });
const base = (opt('--name', mode)).replace(/[^\w.-]+/g, '-');
const files = { json: path.join(out, `${base}.json`), html: path.join(out, `${base}.html`) };
writeFileSync(files.json, JSON.stringify(result, null, 2));
writeFileSync(files.html, renderHtml(result));
if (flag('--md')) { files.md = path.join(out, `${base}.md`); writeFileSync(files.md, renderMarkdown(result)); }

const summary = { mode, status: result.status, files };
if (mode === 'factcheck') Object.assign(summary, { headline: result.headline ?? result.insufficientIndependentSources?.reason ?? null, vScore: result.score?.final ?? null, band: result.score?.status ?? null, verdict: result.verdict ?? null, selfChecks: result.selfChecks && { pass: result.selfChecks.pass, fail: result.selfChecks.fail, unresolved: result.selfChecks.unresolved } });
if (mode === 'forecast') Object.assign(summary, { method: result.mode, p: result.p ?? null, low: result.low ?? null, high: result.high ?? null, refusals: (result.refusals ?? []).map((r) => r.code), errors: result.errors });
if (mode === 'trend') Object.assign(summary, { direction: result.direction ?? null, theilSenSlope: result.theilSen?.slope ?? null, mannKendallP: result.mannKendall?.p ?? null, reason: result.reason });
console.log(JSON.stringify(summary));
process.exit(result.status === 'invalid' ? 1 : 0);
