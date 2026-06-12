/**
 * In-process unit tests for the CLI.
 *
 * The subprocess tests in cli.test.ts exercise the built dist/cli.js;
 * these tests drive main() from src/cli.ts directly so command parsing,
 * input handling, output writing, and exit-code mapping run inside the
 * jest process (and therefore count toward coverage).
 */

import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { runDeltaEngine } from '@uvrn/core';
import { main } from '../src/cli';

const VALID_BUNDLE = {
  bundleId: 'unit-001',
  claim: 'In-process test claim',
  thresholdPct: 0.05,
  dataSpecs: [
    {
      id: 'source-a',
      label: 'Source A',
      sourceKind: 'metric',
      originDocIds: ['doc-a'],
      metrics: [{ key: 'value', value: 100 }],
    },
    {
      id: 'source-b',
      label: 'Source B',
      sourceKind: 'metric',
      originDocIds: ['doc-b'],
      metrics: [{ key: 'value', value: 102 }],
    },
  ],
};

interface CliResult {
  code: number;
  stdout: string[];
  stderr: string[];
}

/**
 * Run the CLI in-process. process.exit is stubbed to record the first exit
 * code (every command path terminates with process.exit at tail position),
 * and console output is captured.
 */
async function runCli(args: string[]): Promise<CliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let code: number | undefined;

  const exitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation(((exitCode?: string | number | null) => {
      if (code === undefined) code = typeof exitCode === 'number' ? exitCode : 0;
      return undefined as never;
    }) as typeof process.exit);
  const logSpy = jest.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    stdout.push(parts.map(String).join(' '));
  });
  const errSpy = jest.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    stderr.push(parts.map(String).join(' '));
  });
  const argvBackup = process.argv;
  process.argv = ['node', 'uvrn', ...args];

  try {
    main();
    const deadline = Date.now() + 5000;
    while (code === undefined && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  } finally {
    process.argv = argvBackup;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
  }

  if (code === undefined) {
    throw new Error(`CLI did not exit within 5s for: ${args.join(' ')}`);
  }
  return { code, stdout, stderr };
}

let tempDir: string;

function writeTemp(name: string, content: string): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, content);
  return file;
}

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvrn-cli-unit-'));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('run command (in-process)', () => {
  test('produces a verifiable receipt on stdout and exits 0', async () => {
    const bundleFile = writeTemp('valid.json', JSON.stringify(VALID_BUNDLE));
    const result = await runCli(['run', bundleFile, '--quiet']);

    expect(result.code).toBe(0);
    const receipt = JSON.parse(result.stdout.join(''));
    expect(receipt.bundleId).toBe('unit-001');
    expect(receipt.sources).toEqual(['Source A', 'Source B']);
    expect(receipt.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('pretty-prints with --pretty', async () => {
    const bundleFile = writeTemp('pretty.json', JSON.stringify(VALID_BUNDLE));
    const result = await runCli(['run', bundleFile, '--pretty', '--quiet']);

    expect(result.code).toBe(0);
    expect(result.stdout.join('')).toContain('\n  "bundleId"');
  });

  test('writes to --output file and reports the path when not quiet', async () => {
    const bundleFile = writeTemp('out-src.json', JSON.stringify(VALID_BUNDLE));
    const receiptFile = path.join(tempDir, 'out-receipt.json');
    const result = await runCli(['run', bundleFile, '--output', receiptFile]);

    expect(result.code).toBe(0);
    expect(result.stderr.join('\n')).toContain('Output written to:');
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf-8'));
    expect(receipt.bundleId).toBe('unit-001');
  });

  test('exits 3 when the --output path is unwritable', async () => {
    const bundleFile = writeTemp('out-bad.json', JSON.stringify(VALID_BUNDLE));
    const badOutput = path.join(tempDir, 'no-such-dir', 'receipt.json');
    const result = await runCli(['run', bundleFile, '--output', badOutput]);

    expect(result.code).toBe(3);
    expect(result.stderr.join('\n')).toContain('Failed to write output file');
  });

  test('exits 1 for a structurally invalid bundle', async () => {
    const bundleFile = writeTemp('invalid-bundle.json', JSON.stringify({ bundleId: 'x' }));
    const result = await runCli(['run', bundleFile]);

    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain('Invalid DeltaBundle');
  });

  test('exits 2 for malformed JSON and stays silent with --quiet', async () => {
    const bundleFile = writeTemp('broken.json', '{ not json }');

    const loud = await runCli(['run', bundleFile]);
    expect(loud.code).toBe(2);
    expect(loud.stderr.join('\n')).toContain('Invalid JSON');

    const quiet = await runCli(['run', bundleFile, '--quiet']);
    expect(quiet.code).toBe(2);
    expect(quiet.stderr).toHaveLength(0);
  });

  test('exits 3 when the input file does not exist', async () => {
    const result = await runCli(['run', path.join(tempDir, 'missing.json')]);
    expect(result.code).toBe(3);
    expect(result.stderr.join('\n')).toContain('Failed to read input');
  });
});

describe('run command over HTTP', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/bundle.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(VALID_BUNDLE));
      } else {
        res.writeHead(404, 'Not Found');
        res.end('nope');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  test('fetches a bundle from a URL', async () => {
    const result = await runCli(['run', `${baseUrl}/bundle.json`, '--quiet']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.join('')).bundleId).toBe('unit-001');
  });

  test('maps non-2xx responses to an input error (exit 3)', async () => {
    const result = await runCli(['run', `${baseUrl}/nope.json`]);
    expect(result.code).toBe(3);
    expect(result.stderr.join('\n')).toContain('HTTP 404');
  });
});

describe('validate command (in-process)', () => {
  test('valid bundle: exits 0 and emits { valid: true }', async () => {
    const bundleFile = writeTemp('validate-ok.json', JSON.stringify(VALID_BUNDLE));
    const result = await runCli(['validate', bundleFile]);

    expect(result.code).toBe(0);
    expect(result.stdout.join('\n')).toContain('✓ Bundle is valid');
    expect(JSON.parse(result.stdout[result.stdout.length - 1]!)).toEqual({ valid: true });
  });

  test('invalid bundle: exits 1 and emits the validation error', async () => {
    const bundleFile = writeTemp('validate-bad.json', JSON.stringify({ bundleId: 'x' }));
    const result = await runCli(['validate', bundleFile]);

    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain('✗ Bundle is invalid');
    const payload = JSON.parse(result.stdout[result.stdout.length - 1]!);
    expect(payload.valid).toBe(false);
    expect(payload.error).toBeTruthy();
  });

  test('unreadable input: exits 3', async () => {
    const result = await runCli(['validate', path.join(tempDir, 'missing.json')]);
    expect(result.code).toBe(3);
  });
});

describe('verify command (in-process)', () => {
  test('verifies a freshly generated receipt and exits 0', async () => {
    const receipt = runDeltaEngine(VALID_BUNDLE as Parameters<typeof runDeltaEngine>[0]);
    const receiptFile = writeTemp('verify-ok.json', JSON.stringify(receipt));
    const result = await runCli(['verify', receiptFile]);

    expect(result.code).toBe(0);
    expect(result.stdout.join('\n')).toContain('✓ Receipt is valid');
    const payload = JSON.parse(result.stdout[result.stdout.length - 1]!);
    expect(payload).toEqual({ verified: true, hash: receipt.hash });
  });

  test('detects tampering: exits 2 with expected/computed hashes', async () => {
    const receipt = runDeltaEngine(VALID_BUNDLE as Parameters<typeof runDeltaEngine>[0]);
    const tampered = { ...receipt, outcome: 'tampered' };
    const receiptFile = writeTemp('verify-tampered.json', JSON.stringify(tampered));
    const result = await runCli(['verify', receiptFile]);

    expect(result.code).toBe(2);
    expect(result.stderr.join('\n')).toContain('✗ Receipt verification failed');
    expect(result.stderr.join('\n')).toContain('Expected:');
    const payload = JSON.parse(result.stdout[result.stdout.length - 1]!);
    expect(payload.verified).toBe(false);
    expect(payload.recomputedHash).not.toBe(tampered.hash);
  });

  test('unreadable input: exits 3', async () => {
    const result = await runCli(['verify', path.join(tempDir, 'missing.json')]);
    expect(result.code).toBe(3);
  });
});

describe('verify-receipt (NetworkReceipt full verification)', () => {
  const { wrapDeltaReceipt, signReceipt, generateReceiptKeyPair } = require('@uvrn/receipt');
  const { hashReceipt } = require('@uvrn/core');
  const { writeFileSync, mkdtempSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');

  function signedFixture() {
    const payload = {
      bundleId: 'cli-fixture',
      deltaFinal: 0.01,
      sources: ['A', 'B'],
      rounds: [{ round: 1, deltasByMetric: { v: 0.01 }, withinThreshold: true, witnessRequired: false }],
      suggestedFixes: [],
      outcome: 'consensus',
      ts: '2026-06-10T12:00:00.000Z',
    };
    const delta = { ...payload, hash: hashReceipt(payload) };
    const keys = generateReceiptKeyPair();
    const receipt = signReceipt(
      wrapDeltaReceipt(delta, { claim: 'cli claim', source: 'cli-test', action: 'delta.consensus' }),
      { privateKey: keys.privateKey, publicKeyRef: 'cli-pk-1' }
    );
    return { receipt, publicKey: keys.publicKey };
  }

  it('verifies a signed NetworkReceipt with --key and exits 0', async () => {
    const { receipt, publicKey } = signedFixture();
    const dir = mkdtempSync(join(tmpdir(), 'uvrn-cli-'));
    const file = join(dir, 'receipt.json');
    writeFileSync(file, JSON.stringify(receipt));
    const result = await runCli(['verify-receipt', file, '--key', publicKey, '--quiet']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout[result.stdout.length - 1])).toMatchObject({
      verified: true, integrityOk: true, signatureOk: true,
    });
  });

  it('reports integrity-checked-only without a key (exit 0, verified false)', async () => {
    const { receipt } = signedFixture();
    const dir = mkdtempSync(join(tmpdir(), 'uvrn-cli-'));
    const file = join(dir, 'receipt.json');
    writeFileSync(file, JSON.stringify(receipt));
    const result = await runCli(['verify-receipt', file, '--quiet']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout[result.stdout.length - 1])).toMatchObject({
      verified: false, integrityOk: true,
    });
  });

  it('fails on a tampered receipt (non-zero exit)', async () => {
    const { receipt, publicKey } = signedFixture();
    const tampered = { ...receipt, claim: { ...receipt.claim, text: 'rewritten' } };
    const dir = mkdtempSync(join(tmpdir(), 'uvrn-cli-'));
    const file = join(dir, 'receipt.json');
    writeFileSync(file, JSON.stringify(tampered));
    const result = await runCli(['verify-receipt', file, '--key', publicKey, '--quiet']);
    expect(result.code).not.toBe(0);
    expect(JSON.parse(result.stdout[result.stdout.length - 1])).toMatchObject({
      verified: false, integrityOk: false,
    });
  });
});
