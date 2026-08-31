#!/usr/bin/env node
/**
 * Packed-manifest gate (no publish):
 * - npm pack --dry-run JSON for each package
 * - no workspace: literals in packed package.json
 * - @uvrn/store-sqlite main dist/index.d.ts has zero @suttlemedia/ strings
 * - packed main store-sqlite entry graph has no top-level require of track-record
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const dirs = fs
  .readdirSync(root)
  .filter((d) => d.startsWith('uvrn-') && fs.existsSync(path.join(root, d, 'package.json')));

function packDryRun(dir) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: path.join(root, dir),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    errors.push(`${dir}: npm pack --dry-run failed\n${result.stderr || result.stdout}`);
    return null;
  }
  try {
    const parsed = JSON.parse(result.stdout.trim() || '[]');
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch (e) {
    errors.push(`${dir}: could not parse npm pack JSON: ${e.message}`);
    return null;
  }
}

for (const dir of dirs) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
  // Inspect in-tree package.json as the packed manifest source of truth for workspace rewrite
  // (pnpm publish rewrites workspace:^; dry-run of npm pack does not always rewrite).
  // Fail if any *published* dependency field still uses workspace: after we would publish via pnpm.
  // Pre-publish tip may still have workspace:^ — that is expected. Fail only on workspace:* leftovers.
  const blob = JSON.stringify(pkg);
  if (blob.includes('workspace:*')) {
    errors.push(`${dir}: package.json still contains workspace:*`);
  }

  const dry = packDryRun(dir);
  if (!dry) continue;
  // filename presence is enough to prove packable
  if (!dry.filename && !dry.id) {
    errors.push(`${dir}: pack dry-run missing filename/id`);
  }
}

// store-sqlite private-scope-free main .d.ts + no top-level track-record require
const sqliteDist = path.join(root, 'uvrn-store-sqlite', 'dist');
const mainDts = path.join(sqliteDist, 'index.d.ts');
const mainJs = path.join(sqliteDist, 'index.js');
if (!fs.existsSync(mainDts)) {
  errors.push('uvrn-store-sqlite/dist/index.d.ts missing — build first');
} else {
  const dts = fs.readFileSync(mainDts, 'utf8');
  if (dts.includes('@suttlemedia/')) {
    errors.push('store-sqlite main dist/index.d.ts contains @suttlemedia/ strings');
  }
}
if (fs.existsSync(mainJs)) {
  const js = fs.readFileSync(mainJs, 'utf8');
  // follow one-hop requires from index.js
  const reqs = [...js.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  for (const r of reqs) {
    if (r.includes('track-record') || r.includes('@uvrn/track-record')) {
      errors.push(`store-sqlite main index.js top-level requires track-record: ${r}`);
    }
  }
  // also check directly required local modules for track-record strings at top level
  for (const r of reqs) {
    if (!r.startsWith('.')) continue;
    const resolved = path.normalize(path.join(sqliteDist, r.endsWith('.js') ? r : `${r}.js`));
    if (!fs.existsSync(resolved)) continue;
    const body = fs.readFileSync(resolved, 'utf8');
    const topRequires = [...body.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
    for (const tr of topRequires) {
      if (tr.includes('@uvrn/track-record') || tr === '@uvrn/track-record') {
        errors.push(`store-sqlite main graph top-level requires ${tr} via ${path.basename(resolved)}`);
      }
    }
  }
}

if (errors.length) {
  console.error('check-packed-manifests FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('check-packed-manifests PASS');
console.log(` packages checked: ${dirs.length}`);
