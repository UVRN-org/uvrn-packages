#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const packageDirs = ['uvrn-core', 'uvrn-sdk', 'uvrn-adapter', 'uvrn-mcp', 'uvrn-api', 'uvrn-cli'];

function findTarballs() {
  const out = [];
  for (const dir of packageDirs) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    const files = fs.readdirSync(full);
    const tgz = files.find((f) => f.endsWith('.tgz'));
    if (tgz) out.push(path.join(full, tgz));
  }
  return out;
}

function checkManifest(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const sections = ['dependencies', 'peerDependencies', 'optionalDependencies'];
  for (const section of sections) {
    const obj = pkg[section];
    if (!obj || typeof obj !== 'object') continue;
    for (const [name, value] of Object.entries(obj)) {
      if (String(value).includes('workspace:')) {
        return { ok: false, msg: `${pkg.name}: ${section}.${name} = ${value}` };
      }
    }
  }
  return { ok: true };
}

// Optional: pass directory containing tarballs; else use repo and expect tarballs in package dirs
const tarballDir = process.argv[2];
let tarballs;
if (tarballDir) {
  tarballs = fs.readdirSync(tarballDir)
    .filter((f) => f.endsWith('.tgz'))
    .map((f) => path.join(tarballDir, f));
} else {
  tarballs = findTarballs();
}

if (tarballs.length === 0) {
  console.error('check-packed-manifests: no .tgz files found. Run pnpm pack in each package first.');
  process.exit(1);
}

const os = require('os');
const tmpBase = path.join(os.tmpdir(), 'uvrn-pack-check-' + Date.now());
fs.mkdirSync(tmpBase, { recursive: true });
let exitCode = 0;
try {
  for (const tgz of tarballs) {
    const extractDir = path.join(tmpBase, path.basename(tgz, '.tgz'));
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`tar -xzf "${tgz}" -C "${extractDir}"`, { stdio: 'inherit' });
    const pkgDir = fs.readdirSync(extractDir)[0];
    const pkgJson = path.join(extractDir, pkgDir, 'package.json');
    if (!fs.existsSync(pkgJson)) {
      console.error('No package.json in tarball:', tgz);
      exitCode = 1;
      continue;
    }
    const result = checkManifest(pkgJson);
    if (!result.ok) {
      console.error('FAIL:', result.msg);
      exitCode = 1;
    } else {
      console.log('OK:', path.basename(tgz));
    }
  }
} finally {
  fs.rmSync(tmpBase, { recursive: true, force: true });
}
process.exit(exitCode);
