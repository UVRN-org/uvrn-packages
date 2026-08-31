#!/usr/bin/env node
/**
 * Phase 1 mechanical prep (no publish):
 * 1D0 rename drawers @uvrn/* → @suttlemedia/*
 * 1C workspace:* → workspace:^; bump public 30 to 5.0.0; hard-cut @uvrn ^5.0.0
 * 1D UNLICENSED drawers; repository urls; packageManager pin
 *
 * NOTE: visual, chart-memory, track-record were promoted to public @uvrn/* —
 * do not re-run this script on those packages (DRAWERS = ops-only four).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRAWERS = new Set([
  'arcanum',
  'case-bank',
  'checker',
  'store-d1-client',
]);

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.txt',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '.turbo',
  'output',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function rewriteDrawerScopes(text) {
  let next = text;
  for (const d of DRAWERS) {
    // package names / imports / docs
    next = next.replaceAll(`@uvrn/${d}`, `@suttlemedia/${d}`);
  }
  return next;
}

function hardCutUvrnRanges(pkg) {
  const cut = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string') continue;
      if (k.startsWith('@uvrn/') && !k.startsWith('@suttlemedia/')) {
        if (v === 'workspace:*' || v === 'workspace:^') continue;
        // hard-cut public @uvrn peers/deps to ^5.0.0
        obj[k] = '^5.0.0';
      }
      if (k === '@suttlemedia/arcanum') {
        // MCP / consumers: keep ^0.1.0
        if (v === 'workspace:*' || v === 'workspace:^') continue;
        if (v === '>=0.1.0' || v.startsWith('^0.') || v.startsWith('0.')) {
          obj[k] = '^0.1.0';
        }
      } else if (k.startsWith('@suttlemedia/')) {
        if (v === 'workspace:*' || v === 'workspace:^') continue;
        // drawer consumers outside workspace protocol stay on ^5.0.0 except arcanum
        if (k !== '@suttlemedia/arcanum') obj[k] = '^5.0.0';
      }
    }
  };
  cut(pkg.dependencies);
  cut(pkg.devDependencies);
  cut(pkg.peerDependencies);
  cut(pkg.optionalDependencies);
}

function workspaceStarToCaret(pkg) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const obj = pkg[field];
    if (!obj) continue;
    for (const [k, v] of Object.entries(obj)) {
      if (v === 'workspace:*') obj[k] = 'workspace:^';
    }
  }
}

function pkgDirName(name) {
  // @uvrn/foo or @suttlemedia/foo → uvrn-foo
  const short = name.split('/')[1];
  return `uvrn-${short}`;
}

const files = walk(root);
let rewritten = 0;
for (const file of files) {
  const ext = path.extname(file);
  if (!TEXT_EXT.has(ext) && path.basename(file) !== 'AGENTS.md' && path.basename(file) !== 'CLAUDE.md') {
    continue;
  }
  // skip this script itself mid-write? ok to rewrite docs mentioning old names
  if (file.endsWith('scripts/phase1-mechanical.mjs')) continue;
  const raw = fs.readFileSync(file, 'utf8');
  let next = rewriteDrawerScopes(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}

// package.json version / hygiene pass
const pkgDirs = fs
  .readdirSync(root)
  .filter((d) => d.startsWith('uvrn-') && fs.existsSync(path.join(root, d, 'package.json')));

for (const dir of pkgDirs) {
  const pj = path.join(root, dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
  const short = (pkg.name || '').split('/')[1];
  const isDrawer = DRAWERS.has(short);

  if (isDrawer) {
    pkg.name = `@suttlemedia/${short}`;
    pkg.private = true;
    pkg.license = 'UNLICENSED';
    if (short === 'arcanum') {
      pkg.version = '0.1.0';
    } else {
      pkg.version = '5.0.0';
    }
    if (!pkg.repository) {
      pkg.repository = {
        type: 'git',
        url: 'https://github.com/UVRN-org/uvrn-packages-v2.git',
        directory: dir,
      };
    } else {
      pkg.repository.url = 'https://github.com/UVRN-org/uvrn-packages-v2.git';
      pkg.repository.directory = dir;
    }
    // Do not set publishConfig.access public on drawers
    if (pkg.publishConfig && pkg.publishConfig.access === 'public') {
      delete pkg.publishConfig.access;
    }
  } else {
    // public 30
    pkg.version = '5.0.0';
    if (!pkg.publishConfig) pkg.publishConfig = {};
    pkg.publishConfig.access = 'public';
    if (pkg.repository) {
      pkg.repository.url = pkg.repository.url.replace(
        'uvrn-packages.git',
        'uvrn-packages-v2.git'
      );
    }
  }

  workspaceStarToCaret(pkg);
  hardCutUvrnRanges(pkg);

  // MCP optional peer explicit
  if (pkg.name === '@uvrn/mcp') {
    if (!pkg.peerDependencies) pkg.peerDependencies = {};
    delete pkg.peerDependencies['@uvrn/arcanum'];
    pkg.peerDependencies['@suttlemedia/arcanum'] = '^0.1.0';
    if (!pkg.peerDependenciesMeta) pkg.peerDependenciesMeta = {};
    delete pkg.peerDependenciesMeta['@uvrn/arcanum'];
    pkg.peerDependenciesMeta['@suttlemedia/arcanum'] = { optional: true };
    if (pkg.devDependencies && pkg.devDependencies['@uvrn/arcanum']) {
      delete pkg.devDependencies['@uvrn/arcanum'];
      pkg.devDependencies['@suttlemedia/arcanum'] = 'workspace:^';
    }
  }

  fs.writeFileSync(pj, JSON.stringify(pkg, null, 2) + '\n');
}

// root package.json
const rootPkgPath = path.join(root, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
rootPkg.packageManager = 'pnpm@11.5.2';
// update filter scripts that hardcode @uvrn/case-bank etc if any
const scripts = rootPkg.scripts || {};
for (const [k, v] of Object.entries(scripts)) {
  if (typeof v === 'string') scripts[k] = rewriteDrawerScopes(v);
}
rootPkg.scripts = scripts;
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');

// AGENTS.md law #3 — require workspace:^
const agentsPath = path.join(root, 'AGENTS.md');
if (fs.existsSync(agentsPath)) {
  let agents = fs.readFileSync(agentsPath, 'utf8');
  agents = agents.replace(
    /3\.\s+\*\*In-repo dependencies use `workspace:\^`\*\*[^\n]*(?:\n[^\n]*)?/,
    '3. **In-repo dependencies use `workspace:^`** so publishing rewrites them to the released\n' +
      '   version range. Do not use `workspace:*` in this tip.'
  );
  fs.writeFileSync(agentsPath, agents);
}

console.log(
  JSON.stringify(
    {
      rewrittenFiles: rewritten,
      drawers: [...DRAWERS].map((d) => {
        const p = JSON.parse(fs.readFileSync(path.join(root, `uvrn-${d}`, 'package.json'), 'utf8'));
        return { name: p.name, version: p.version, private: p.private, license: p.license };
      }),
      samplePublic: ['core', 'mcp', 'store-sqlite'].map((d) => {
        const p = JSON.parse(fs.readFileSync(path.join(root, `uvrn-${d}`, 'package.json'), 'utf8'));
        return { name: p.name, version: p.version };
      }),
      packageManager: rootPkg.packageManager,
    },
    null,
    2
  )
);
