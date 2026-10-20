// Universal layer: install script, install prompt and the agent-neutral zip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS } from '../scripts/install.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = (args) => spawnSync(process.execPath, args, { encoding: 'utf8' });
const installer = path.join(root, 'scripts/install.mjs');

test('install.mjs copies exactly the three skills, and each installed copy runs', () => {
  const dest = path.join(mkdtempSync(path.join(tmpdir(), 'uvrn-universal-')), 'skills');
  const r = node([installer, '--dest', dest, '--check']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.deepEqual(readdirSync(dest).sort(), [...SKILLS].sort());
  for (const s of SKILLS) {
    for (const f of ['SKILL.md', 'NOTICE', 'scripts/run.mjs', 'lib/report.mjs']) assert.ok(existsSync(path.join(dest, s, f)), `${s}/${f}`);
    assert.match(r.stdout, new RegExp(`ok\\s+${s}`));
  }
});

test('install.mjs refuses an existing skill folder without --force and never deletes', () => {
  const dest = path.join(mkdtempSync(path.join(tmpdir(), 'uvrn-universal-')), 'skills');
  assert.equal(node([installer, '--dest', dest]).status, 0);
  const keep = path.join(dest, 'uvrn-trends', 'my-notes.txt');
  writeFileSync(keep, 'mine');
  const again = node([installer, '--dest', dest]);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists; re-run with --force/);
  assert.equal(node([installer, '--dest', dest, '--force']).status, 0);
  assert.equal(readFileSync(keep, 'utf8'), 'mine', '--force overwrites skill files but leaves other files alone');
});

test('install.mjs without --dest fails with a plain message', () => {
  const r = node([installer]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing --dest/);
});

test('install prompt: environment check first, no Claude-only assumptions, three skills only', () => {
  const md = readFileSync(path.join(root, 'universal/INSTALL-PROMPT.md'), 'utf8');
  const prompt = md.split('\n---\n')[1];
  assert.ok(prompt, 'prompt sits between --- lines');
  assert.match(prompt, /Environment check \(do this first\)/);
  assert.match(prompt, /Do not assume Claude Code, Claude Desktop or any specific plugin CLI/);
  for (const s of SKILLS) assert.ok(prompt.includes(s), s);
  assert.match(prompt, /Node 18 or newer/);
  assert.match(prompt, /scripts\/install\.mjs --dest <your skills directory> --check/);
  assert.match(prompt, /Install only the three uvrn skills/);
  assert.ok(!/\/plugin (marketplace|install)/.test(prompt), 'no Claude plugin CLI steps');
  for (const text of [md, readFileSync(path.join(root, 'universal/README.md'), 'utf8')]) {
    assert.ok(!/\bverified\b|\bcalibrated\b|\bproven\b/i.test(text.replace(/never "verified"/g, '')), 'honest vocabulary');
  }
});

test('build-universal.mjs: zip holds the three skills and the universal docs', { skip: spawnSync('zip', ['-v']).status !== 0 && 'no zip binary' }, () => {
  const r = node([path.join(root, 'scripts/build-universal.mjs')]);
  assert.equal(r.status, 0, r.stderr);
  const list = spawnSync('unzip', ['-Z1', path.join(root, 'dist/uvrn-skills-universal.zip')], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  for (const f of ['README.md', 'INSTALL-PROMPT.md', 'NOTICE', 'LICENSE']) assert.ok(list.includes(`uvrn-skills/${f}`), f);
  for (const s of SKILLS) for (const f of ['SKILL.md', 'scripts/run.mjs', 'lib/trend.mjs']) assert.ok(list.includes(`uvrn-skills/${s}/${f}`), `${s}/${f}`);
  assert.ok(list.every((p) => p.startsWith('uvrn-skills/')), 'one top-level folder');
  assert.ok(!list.some((p) => /\.claude-plugin|\.DS_Store|tests\/|examples\//.test(p)), 'nothing Claude-specific or extra');
});
