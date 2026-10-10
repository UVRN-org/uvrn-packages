/**
 * `uvrn prob run` — driven in-process against the SPEC golden vectors.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { main } from '../src/cli';

type VectorCase = {
  id: string;
  input: Record<string, unknown>;
  expected: {
    method: string;
    p: number | null;
    probabilityHash: string;
    receiptHash: string;
    refusalCodes: string[];
    signature?: Record<string, unknown>;
  };
};

const vectors = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../SPEC/vectors/probability-v1.json'), 'utf-8')
) as {
  keys: { privateKeySeed: string; publicKeyRef: string };
  cases: VectorCase[];
};

function vector(id: string): VectorCase {
  const found = vectors.cases.find((c) => c.id === id);
  if (!found) throw new Error(`missing vector ${id}`);
  return found;
}

async function runCli(args: string[]): Promise<{ code: number; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let code: number | undefined;
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((exitCode?: number) => {
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
  if (code === undefined) throw new Error(`CLI did not exit for: ${args.join(' ')}`);
  return { code, stdout, stderr };
}

let tempDir: string;

function writeTemp(name: string, content: unknown): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvrn-cli-prob-'));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.UVRN_PROB_PRIVATE_KEY;
  delete process.env.ALT_PROB_KEY;
});

describe('uvrn prob run', () => {
  it('reproduces the golden vector hashes (unsigned)', async () => {
    const c = vector('exchange-binary');
    const result = await runCli(['prob', 'run', writeTemp('exchange.json', c.input), '--quiet']);
    expect(result.code).toBe(0);
    const out = JSON.parse(result.stdout.join(''));
    expect(out.method).toBe(c.expected.method);
    expect(out.p).toBe(c.expected.p);
    expect(out.probabilityHash).toBe(c.expected.probabilityHash);
    expect(out.receipt.receiptHash).toBe(c.expected.receiptHash);
    expect(out.receipt.signature).toBeUndefined();
    expect(out.source).toMatchObject({ unit: '1', quantityKind: 'probability' });
  });

  it('signs with the key from the environment and matches the signed vector', async () => {
    const c = vector('signed-exchange-binary');
    process.env.UVRN_PROB_PRIVATE_KEY = vectors.keys.privateKeySeed;
    const result = await runCli([
      'prob', 'run', writeTemp('signed.json', c.input), '--key-ref', vectors.keys.publicKeyRef,
      '--signed-at', String(c.expected.signature!.signedAt),
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr.join('\n')).toContain('(signed)');
    const out = JSON.parse(result.stdout.join(''));
    expect(out.receipt.receiptHash).toBe(c.expected.receiptHash);
    expect(out.receipt.signature).toMatchObject(c.expected.signature!);
    expect(JSON.stringify(out)).not.toContain(vectors.keys.privateKeySeed);
  });

  it('honors --key-env', async () => {
    const c = vector('exchange-binary');
    process.env.ALT_PROB_KEY = vectors.keys.privateKeySeed;
    const result = await runCli([
      'prob', 'run', writeTemp('alt.json', c.input), '--key-ref', 'alt-ref', '--key-env', 'ALT_PROB_KEY', '--quiet',
    ]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.join('')).receipt.signature.publicKeyRef).toBe('alt-ref');
  });

  it('exits 3 when --key-ref is given without the key env var', async () => {
    const c = vector('exchange-binary');
    const result = await runCli(['prob', 'run', writeTemp('nokey.json', c.input), '--key-ref', 'x']);
    expect(result.code).toBe(3);
    expect(result.stderr.join('\n')).toContain('UVRN_PROB_PRIVATE_KEY is not set');
  });

  it('treats insufficient_basis as a valid result (exit 0) and names the refusal codes', async () => {
    const c = vector('no-candidate');
    const result = await runCli(['prob', 'run', writeTemp('none.json', c.input)]);
    expect(result.code).toBe(0);
    expect(result.stderr.join('\n')).toContain('insufficient_basis');
    const out = JSON.parse(result.stdout[result.stdout.length - 1]!);
    expect(out.method).toBe('insufficient_basis');
    expect(out.p).toBeNull();
    expect(out.source).toBeNull();
    expect(out.probabilityHash).toBe(c.expected.probabilityHash);
  });

  it('exits 1 for structurally invalid input (bad outcomeHash)', async () => {
    const c = vector('exchange-binary');
    const bad = { ...c.input, outcome: { outcomeHash: 'not-a-hash' } };
    const result = await runCli(['prob', 'run', writeTemp('bad.json', bad)]);
    expect(result.code).toBe(1);
  });

  it.each(['v2', 'v3'])('exits 1 with a library-only message for %s forecast input', async (v) => {
    const forecast = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, `../../SPEC/vectors/probability-${v}.json`), 'utf-8')
    ) as { cases: VectorCase[] };
    const result = await runCli(['prob', 'run', writeTemp(`${v}.json`, forecast.cases[0]!.input)]);
    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain(
      'uvrn prob run accepts uvrn-probability-input-1 only; input-2/input-3 are library-only (runForecast).'
    );
  });

  it('exits 3 for malformed JSON or a missing file', async () => {
    expect((await runCli(['prob', 'run', writeTemp('broken.json', '{ nope'), '--quiet'])).code).toBe(3);
    expect((await runCli(['prob', 'run', path.join(tempDir, 'missing.json'), '--quiet'])).code).toBe(3);
  });

  it('pretty-prints and writes to --output', async () => {
    const c = vector('baserate-small-n');
    const outFile = path.join(tempDir, 'prob-out.json');
    const result = await runCli(['prob', 'run', writeTemp('br.json', c.input), '--pretty', '-o', outFile]);
    expect(result.code).toBe(0);
    const written = fs.readFileSync(outFile, 'utf-8');
    expect(written).toContain('\n  "specVersion"');
    expect(JSON.parse(written).probabilityHash).toBe(c.expected.probabilityHash);
  });
});
