#!/usr/bin/env node
/**
 * Public dry-run: prove packability of all 33 @uvrn/* packages WITHOUT publishing.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_PUBLIC = 33;

const errors = [];
const publicOk = [];

function dryPack(dir) {
  const result = spawnSync('npm', ['pack', '--dry-run'], {
    cwd: path.join(root, dir),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return { ok: false, detail: result.stderr || result.stdout };
  }
  return { ok: true, detail: (result.stdout || '').trim().split('\n').pop() };
}

const dirs = fs
  .readdirSync(root)
  .filter((d) => d.startsWith('uvrn-') && fs.existsSync(path.join(root, d, 'package.json')));

for (const dir of dirs) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
  const res = dryPack(dir);
  if (!res.ok) {
    errors.push(`${pkg.name}: dry-run failed\n${res.detail}`);
    continue;
  }
  publicOk.push(pkg.name);
}

if (publicOk.length !== EXPECTED_PUBLIC) {
  errors.push(`public dry-run count ${publicOk.length} != ${EXPECTED_PUBLIC}`);
}

if (errors.length) {
  console.error('dual-dry-run FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log('dual-dry-run PASS (no publish)');
console.log(` @uvrn public: ${publicOk.length}`);
