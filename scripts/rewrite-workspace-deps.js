#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function findRepoRoot(cwd) {
  let dir = cwd;
  for (;;) {
    const pnpm = path.join(dir, 'pnpm-workspace.yaml');
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pnpm)) return dir;
    try {
      const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      if (j.workspaces && Array.isArray(j.workspaces)) return dir;
    } catch (_) {}
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not find repo root (no pnpm-workspace.yaml or workspaces)');
    dir = parent;
  }
}

function rewrite(manifest, coreVersion) {
  const range = `^${coreVersion}`;
  const sections = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];
  for (const section of sections) {
    if (!manifest[section] || typeof manifest[section] !== 'object') continue;
    for (const key of Object.keys(manifest[section])) {
      if (key !== '@uvrn/core') continue;
      const v = manifest[section][key];
      if (typeof v === 'string' && (v.startsWith('workspace:^') || v.startsWith('workspace:*'))) {
        manifest[section][key] = range;
      }
    }
  }
  return manifest;
}

const cwd = process.cwd();
const root = findRepoRoot(cwd);
const corePkgPath = path.join(root, 'uvrn-core', 'package.json');
if (!fs.existsSync(corePkgPath)) throw new Error('uvrn-core/package.json not found at ' + corePkgPath);
const coreVersion = JSON.parse(fs.readFileSync(corePkgPath, 'utf8')).version;
if (!coreVersion) throw new Error('uvrn/core version not found');

const pkgPath = path.join(cwd, 'package.json');
const orig = fs.readFileSync(pkgPath, 'utf8');
const manifest = JSON.parse(orig);
const modified = rewrite(manifest, coreVersion);

fs.writeFileSync(path.join(cwd, 'package.json.orig'), orig, 'utf8');
fs.writeFileSync(pkgPath, JSON.stringify(modified, null, 2) + '\n', 'utf8');
