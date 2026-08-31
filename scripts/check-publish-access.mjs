#!/usr/bin/env node
/**
 * Pre-publish gate for public @uvrn/* monorepo (33 packages).
 * PASS: all workspace packages are @uvrn/* with publishConfig.access=public
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_PUBLIC = 33;

const errors = [];
const notes = [];

const dirs = fs
  .readdirSync(root)
  .filter((d) => d.startsWith('uvrn-') && fs.existsSync(path.join(root, d, 'package.json')));

const packages = dirs.map((d) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, d, 'package.json'), 'utf8'));
  return { dir: d, pkg };
});

let publicCount = 0;

for (const { dir, pkg } of packages) {
  const name = pkg.name || '';
  publicCount++;
  if (!name.startsWith('@uvrn/')) {
    errors.push(`${dir}: public package expected @uvrn/*, got ${name}`);
  }
  if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') {
    errors.push(`${dir}: public package missing publishConfig.access=public`);
  }
  notes.push(`${name}: access=public`);
}

if (publicCount !== EXPECTED_PUBLIC) {
  errors.push(`expected ${EXPECTED_PUBLIC} public @uvrn packages, found ${publicCount}`);
}

if (errors.length) {
  console.error('check-publish-access FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log('check-publish-access PASS');
console.log(` public=${publicCount} drawers=0`);
for (const n of notes) console.log(' ', n);
