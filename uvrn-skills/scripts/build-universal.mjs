#!/usr/bin/env node
// Build dist/uvrn-skills-universal.zip: the three self-contained skill folders plus the universal docs,
// for agents that take a zip upload. Agent-neutral; the Claude .plugin packaging is separate and unchanged.
//   node scripts/build-universal.mjs
// Uses the system `zip` binary (macOS / Linux). dist/ is git-ignored; attach the zip to a release.
import { cpSync, mkdirSync, mkdtempSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS } from './install.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '..');
const OUT = path.join(root, 'dist', 'uvrn-skills-universal.zip');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.error || r.status !== 0) {
    console.error(`build-universal: ${cmd} ${args.join(' ')} failed: ${(r.error?.message || r.stderr || r.stdout || `exit ${r.status}`).trim()}`);
    process.exit(1);
  }
  return r;
}

if (spawnSync('zip', ['-v'], { encoding: 'utf8' }).status !== 0) {
  console.error('build-universal: the `zip` command was not found. Install zip (macOS and most Linux have it), then re-run.');
  process.exit(1);
}
run(process.execPath, [path.join(root, 'scripts/sync-skills.mjs'), '--check']);

const stage = path.join(mkdtempSync(path.join(tmpdir(), 'uvrn-skills-universal-')), 'uvrn-skills');
mkdirSync(stage, { recursive: true });
for (const s of SKILLS) cpSync(path.join(root, 'skills', s), path.join(stage, s), { recursive: true });
cpSync(path.join(root, 'universal', 'README.md'), path.join(stage, 'README.md'));
cpSync(path.join(root, 'universal', 'INSTALL-PROMPT.md'), path.join(stage, 'INSTALL-PROMPT.md'));
cpSync(path.join(root, 'NOTICE'), path.join(stage, 'NOTICE'));
cpSync(path.join(repo, 'LICENSE'), path.join(stage, 'LICENSE'));

mkdirSync(path.dirname(OUT), { recursive: true });
const tmpZip = `${OUT}.tmp`;
run('zip', ['-r', '-X', '-q', tmpZip, 'uvrn-skills', '-x', '*.DS_Store'], { cwd: path.dirname(stage) });
renameSync(tmpZip, OUT);
console.log(`wrote ${path.relative(root, OUT)}: ${SKILLS.join(', ')} + README.md, INSTALL-PROMPT.md, NOTICE, LICENSE`);
