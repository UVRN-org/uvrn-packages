#!/usr/bin/env node
// Universal install: copy the three self-contained skill folders into any agent's skills directory.
// Zero dependencies (Node >= 18). Copies only skills/uvrn-{factcheck,forecast,trends}; never deletes.
//   node scripts/install.mjs --dest <skills dir> [--force] [--check]
//   --force  overwrite files in an existing skill folder (nothing is removed)
//   --check  run each installed copy's scripts/run.mjs once on a tiny built-in input
import { cpSync, existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SKILLS = ['uvrn-factcheck', 'uvrn-forecast', 'uvrn-trends'];

const NOW = new Date().toISOString();
const SAMPLE = {
  'uvrn-factcheck': ['factcheck', { claim: 'Water boils at 100 °C at sea level', evaluatedAt: NOW, sources: [
    { id: 'a', title: 'Source A', url: 'https://example.org/a', assertion: 'supports', measuredAt: NOW },
    { id: 'b', title: 'Source B', url: 'https://example.org/b', assertion: 'supports', measuredAt: NOW },
  ] }],
  'uvrn-forecast': ['forecast', { forecastId: 'install-check', asOf: NOW, question: { text: 'Install check', resolveBy: '2099-01-01', resolutionRule: 'none' },
    mode: 'baserate', baserate: { referenceClass: { description: 'install check', source: { url: 'https://example.org/r', accessedAt: NOW } }, x: 3, n: 8 } }],
  'uvrn-trends': ['trend', { title: 'Install check', points: [1, 2, 3, 4, 5, 6].map((v, i) => ({ t: `2026-0${i + 1}-01`, v })) }],
};

function fail(msg) {
  console.error(`uvrn-skills install: ${msg}`);
  process.exit(1);
}

function args(argv) {
  const a = { force: argv.includes('--force'), check: argv.includes('--check') };
  const i = argv.indexOf('--dest');
  a.dest = i >= 0 ? argv[i + 1] : undefined;
  return a;
}

/** Copy the three skills into dest. Returns [{ skill, to }]. Throws with a plain message on any problem. */
export function install(dest, { force = false } = {}) {
  if (!dest) throw new Error('missing --dest <skills directory>');
  const out = path.resolve(dest);
  if (existsSync(out) && !statSync(out).isDirectory()) throw new Error(`${out} exists and is not a directory`);
  for (const s of SKILLS) {
    if (!existsSync(path.join(root, 'skills', s, 'SKILL.md'))) throw new Error(`skills/${s} is missing from ${root}`);
    if (existsSync(path.join(out, s)) && !force) throw new Error(`${path.join(out, s)} already exists; re-run with --force to overwrite its files`);
  }
  mkdirSync(out, { recursive: true });
  return SKILLS.map((s) => {
    const to = path.join(out, s);
    cpSync(path.join(root, 'skills', s), to, { recursive: true, force: true });
    return { skill: s, to };
  });
}

/** Run each installed copy once. Returns [{ skill, ok, detail }]. */
export function check(dest) {
  const work = mkdtempSync(path.join(tmpdir(), 'uvrn-skills-check-'));
  return SKILLS.map((s) => {
    const [mode, input] = SAMPLE[s];
    const inFile = path.join(work, `${s}.json`);
    writeFileSync(inFile, JSON.stringify(input));
    const r = spawnSync(process.execPath, [path.join(path.resolve(dest), s, 'scripts/run.mjs'), mode, inFile, '--out', path.join(work, 'out'), '--name', s], { encoding: 'utf8' });
    const ok = r.status === 0;
    return { skill: s, ok, detail: ok ? r.stdout.trim().split('\n').pop() : (r.stderr || r.stdout || `exit ${r.status}`).trim() };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) fail(`Node ${process.versions.node} found; the skills need Node 18 or newer`);
  let done;
  try {
    done = install(a.dest, a);
  } catch (e) {
    fail(e.message);
  }
  for (const d of done) console.log(`installed ${d.skill} -> ${d.to}`);
  if (a.check) {
    const results = check(a.dest);
    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.skill}${r.ok ? '' : `: ${r.detail}`}`);
    if (results.some((r) => !r.ok)) process.exit(1);
  }
  console.log(`done: ${done.length} skills in ${path.resolve(a.dest)}${a.check ? ', each ran once' : ''}`);
}
