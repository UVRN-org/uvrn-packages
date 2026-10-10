import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'uvrn-mcp/plugin-manifest.json'), 'utf8'));
const expectedTools = manifest.capabilities.tools;
const expectedCount = Number(process.env.MCP_EXPECT_TOOL_COUNT ?? expectedTools.length);
const tempRoot = mkdtempSync(join(tmpdir(), 'uvrn-mcp-smoke-'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`
    );
  }
  return result.stdout;
}

function requestServer(entrypoint) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [entrypoint], {
      cwd: dirname(entrypoint),
      env: { ...process.env, LOG_LEVEL: 'error' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const responses = new Map();
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolvePromise(responses);
    };

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const lines = stdout.split('\n');
      stdout = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined) responses.set(message.id, message);
          if (responses.has(2) && responses.has(3) && responses.has(4) && responses.has(5)) finish();
        } catch (error) {
          finish(new Error(`MCP emitted invalid JSON: ${line}\n${error.message}`));
        }
      }
    });
    child.on('error', finish);
    child.on('exit', (code) => {
      if (!settled) finish(new Error(`MCP exited early (${code}): ${stderr}`));
    });

    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'uvrn-tarball-smoke', version: '1.0.0' },
      },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'delta_score_claim',
        arguments: { claim: 'Fixture-only distribution smoke', claimId: 'bp-07-smoke' },
      },
    });
    send({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'delta_verify_identity', arguments: { address: 'fixture-address' } },
    });
    send({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'delta_canon_get', arguments: { canonId: 'fixture-canon' } },
    });

    timer = setTimeout(
      () => finish(new Error(`MCP handshake timed out: ${stderr}`)),
      30_000
    );
  });
}

try {
  const packOutput = JSON.parse(
    run('npm', ['pack', './uvrn-mcp', '--json', '--pack-destination', tempRoot])
  );
  const tarball = join(tempRoot, packOutput[0].filename);
  const installRoot = join(tempRoot, 'consumer');
  mkdirSync(installRoot);
  writeFileSync(join(installRoot, 'package.json'), '{"private":true}\n');
  run('npm', ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: installRoot,
  });

  const scopeRoot = join(installRoot, 'node_modules/@uvrn');
  const installedUvrnPackages = readdirSync(scopeRoot).sort();
  assert.deepEqual(
    installedUvrnPackages,
    ['mcp'],
    `packed MCP must not install @uvrn peers: ${installedUvrnPackages.join(', ')}`
  );

  const entrypoint = join(scopeRoot, 'mcp/dist/index.js');
  const responses = await requestServer(entrypoint);
  const listedTools = responses.get(2)?.result?.tools?.map((tool) => tool.name);
  assert.equal(listedTools?.length, expectedCount, `expected ${expectedCount} MCP tools`);
  assert.deepEqual(listedTools, expectedTools, 'MCP tools must match plugin-manifest.json');

  const call = responses.get(3)?.result;
  assert.equal(call?.isError, undefined, 'fixture-only score call must succeed');
  assert.equal(responses.get(4)?.result?.isError, undefined, 'bundled identity import must resolve');
  assert.equal(responses.get(5)?.result?.isError, undefined, 'bundled canon import must resolve');
  const scoreResult = JSON.parse(call.content[0].text);
  const receipt = await import(join(root, 'uvrn-receipt/dist/index.js'));
  const verification = receipt.verifyReceiptFull(scoreResult.networkReceipt, {
    publicKey: scoreResult.signerPublicKey,
  });
  assert.deepEqual(
    {
      verified: verification.verified,
      integrityOk: verification.integrityOk,
      signatureOk: verification.signatureOk,
    },
    { verified: true, integrityOk: true, signatureOk: true },
    'bundled @uvrn/receipt output must verify with the conformance-tested workspace implementation'
  );

  console.log(
    `PASS: packed @uvrn/mcp installed without @uvrn peers, exposed ${listedTools.length} tools, and produced a verified fixture receipt`
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
