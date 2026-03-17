#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

const root = path.resolve(__dirname, '..');
const packageDirs = ['uvrn-core', 'uvrn-sdk', 'uvrn-adapter', 'uvrn-mcp', 'uvrn-api', 'uvrn-cli'];

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: opts.cwd || root, stdio: 'inherit', ...opts });
}

// 1. Build and pack
console.log('Building...');
run('pnpm run build');
console.log('Packing...');
for (const dir of packageDirs) {
  const dirPath = path.join(root, dir);
  // Remove any existing tarballs so we pack fresh (avoid stale tgz from prior runs)
  try {
    fs.readdirSync(dirPath).filter((f) => f.endsWith('.tgz')).forEach((f) => fs.unlinkSync(path.join(dirPath, f)));
  } catch (_) {}
  run('pnpm pack', { cwd: dirPath });
}

const tarballs = {};
for (const dir of packageDirs) {
  const full = path.join(root, dir);
  const files = fs.readdirSync(full).filter((f) => f.endsWith('.tgz'));
  if (files.length === 0) throw new Error('No tarball in ' + dir);
  const name = dir.replace('uvrn-', '@uvrn/');
  if (dir === 'uvrn-core') tarballs['@uvrn/core'] = path.join(full, files[0]);
  else if (dir === 'uvrn-sdk') tarballs['@uvrn/sdk'] = path.join(full, files[0]);
  else if (dir === 'uvrn-adapter') tarballs['@uvrn/adapter'] = path.join(full, files[0]);
  else if (dir === 'uvrn-mcp') tarballs['@uvrn/mcp'] = path.join(full, files[0]);
  else if (dir === 'uvrn-api') tarballs['@uvrn/api'] = path.join(full, files[0]);
  else if (dir === 'uvrn-cli') tarballs['@uvrn/cli'] = path.join(full, files[0]);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvrn-smoke-'));
process.on('exit', () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} });

const pkg = {
  name: 'uvrn-smoke-consumer',
  version: '1.0.0',
  private: true,
  dependencies: {}
};
for (const [name, tgzPath] of Object.entries(tarballs)) {
  pkg.dependencies[name] = 'file:' + tgzPath;
}
fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));

console.log('Installing in temp project...');
run('npm install', { cwd: tmpDir });

const testScript = `
const path = require('path');
const assert = require('assert');

// @uvrn/core
const core = require('@uvrn/core');
assert(typeof core.runDeltaEngine === 'function' || typeof core.validateBundle === 'function', 'core exports');

// @uvrn/sdk
const sdk = require('@uvrn/sdk');
const mockBundle = {
  bundleId: 's',
  claim: 'c',
  dataSpecs: [
    { id: '1', label: 'L', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'k', value: 1 }] },
    { id: '2', label: 'L2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'k', value: 2 }] }
  ],
  thresholdPct: 0.05
};
const r = sdk.validateBundle(mockBundle);
assert(r && typeof r.valid === 'boolean', 'sdk.validateBundle');

// @uvrn/adapter (main may be stub; ensure package loads)
const adapter = require('@uvrn/adapter');
assert(adapter && typeof adapter === 'object', 'adapter exports');

// @uvrn/cli (bin)
const { execSync } = require('child_process');
const cliPkg = path.join(require.resolve('@uvrn/cli/package.json'), '..');
const cliPath = path.join(cliPkg, 'dist', 'cli.js');
execSync('node ' + JSON.stringify(cliPath) + ' --version', { stdio: 'pipe' });

// @uvrn/api (has main) + createServer regression (no pino-pretty in consumer install)
const api = require('@uvrn/api');
assert(api && api.createServer, 'api exports createServer');
api.createServer().then(function (server) {
  assert(server, 'createServer returned server');
  return server.inject({ method: 'GET', url: '/api/v1/health' }).then(function (res) {
    assert(res.statusCode === 200 || res.statusCode === 503, 'health 200 or 503, got ' + res.statusCode);
    const body = JSON.parse(res.payload);
    assert(body.status !== undefined, 'health has status');
    return server.close();
  });
}).then(function () {
  // @uvrn/sdk replayReceipt (behavior: success + deterministic with core engine)
  const replayBundle = {
    bundleId: 'smoke-replay',
    claim: 'Smoke replay',
    dataSpecs: [
      { id: '1', label: 'L', sourceKind: 'report', originDocIds: [], metrics: [{ key: 'k', value: 10 }] },
      { id: '2', label: 'L2', sourceKind: 'metric', originDocIds: [], metrics: [{ key: 'k', value: 11 }] }
    ],
    thresholdPct: 0.05
  };
  const receipt = core.runDeltaEngine(replayBundle);
  assert(receipt && receipt.hash, 'core.runDeltaEngine returns receipt');
  return sdk.replayReceipt(receipt, replayBundle, function (b) { return Promise.resolve(core.runDeltaEngine(b)); });
}).then(function (replayResult) {
  assert(replayResult.success === true, 'replayReceipt success');
  assert(replayResult.deterministic === true, 'replayReceipt deterministic');
}).then(function () {
  // @uvrn/mcp (ESM): import as library — must not start server; only export createServer/startServer
  return Promise.resolve().then(function () {
    return import('@uvrn/mcp').then(function (mcp) {
      assert(typeof mcp.createServer === 'function', 'mcp.createServer');
      assert(typeof mcp.startServer === 'function', 'mcp.startServer');
    });
  }).catch(function (e) {
    if (e.code === 'ERR_REQUIRE_ESM' || e.message && e.message.includes('Cannot use import')) {
      require('fs').readFileSync(require.resolve('@uvrn/mcp/package.json'), 'utf8');
      return;
    }
    throw e;
  });
}).then(function () {
  console.log('Smoke OK');
  process.exit(0);
}).catch(function (e) {
  console.error('@uvrn/api createServer smoke failed:', e);
  process.exit(1);
});
`;
fs.writeFileSync(path.join(tmpDir, 'smoke.js'), testScript.trim());
run('node smoke.js', { cwd: tmpDir });

// MCP bin lifecycle: run with stdin closed, assert exit code 0 (behavior, not log text)
const mcpRunPath = path.join(tmpDir, 'node_modules/@uvrn/mcp/dist/run.js');
new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [mcpRunPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: tmpDir,
    env: { ...process.env, LOG_LEVEL: 'error' }
  });
  child.stdin.end();
  const t = setTimeout(() => {
    child.kill('SIGTERM');
    reject(new Error('MCP bin did not exit within 5s'));
  }, 5000);
  child.on('close', (code) => {
    clearTimeout(t);
    resolve(code);
  });
  child.on('error', reject);
}).then(function (exitCode) {
  if (exitCode !== 0) {
    console.error('MCP bin lifecycle: expected exit 0, got', exitCode);
    process.exit(1);
  }
  console.log('MCP bin lifecycle OK (exit 0).');
  console.log('Smoke test passed.');
  process.exit(0);
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
