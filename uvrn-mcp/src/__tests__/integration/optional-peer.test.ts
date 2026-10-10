/**
 * Packaging contract for the bundled server (dist/index.js):
 * - every @uvrn/* runtime is bundled EXCEPT the optional peer @uvrn/probability, which is
 *   resolved from the host at call time;
 * - with the peer absent, delta_prob_run returns a clean optional-peer error and every other
 *   tool keeps working;
 * - with the peer present, delta_prob_run uses the installed package (golden probabilityHash);
 * - the public type surface (dist/index.d.ts) imports no @uvrn/* or MCP SDK types, so a solo
 *   install type-checks under strict node16 without skipLibCheck.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createTestBundle } from '../fixtures/bundles';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '../../..');
const distDir = path.join(pkgRoot, 'dist');
const requireFromPkg = createRequire(path.join(pkgRoot, 'package.json'));

const vectors = JSON.parse(
  readFileSync(path.resolve(pkgRoot, '../SPEC/vectors/probability-v1.json'), 'utf-8')
) as { cases: Array<{ id: string; input: unknown; expected: { probabilityHash: string } }> };
const sportsbook = vectors.cases.find((c) => c.id === 'sportsbook-two-way')!;

function realDir(specifier: string): string {
  return path.dirname(requireFromPkg.resolve(`${specifier}/package.json`));
}

/** Install dist/ into an isolated host dir: only the MCP SDK (+ optionally @uvrn/probability). */
function makeHost(withProbability: boolean): { dir: string; entry: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'uvrn-mcp-peer-'));
  const pkgDir = path.join(dir, 'node_modules/@uvrn/mcp');
  mkdirSync(path.join(dir, 'node_modules/@modelcontextprotocol'), { recursive: true });
  cpSync(distDir, path.join(pkgDir, 'dist'), { recursive: true });
  symlinkSync(
    realDir('@modelcontextprotocol/sdk'),
    path.join(dir, 'node_modules/@modelcontextprotocol/sdk'),
    'dir'
  );
  if (withProbability) {
    symlinkSync(realDir('@uvrn/probability'), path.join(dir, 'node_modules/@uvrn/probability'), 'dir');
  }
  return { dir, entry: path.join(pkgDir, 'dist/index.js') };
}

async function connect(entry: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    cwd: path.dirname(entry),
    env: { ...process.env, LOG_LEVEL: 'error', NODE_PATH: '' },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'optional-peer-test', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

function text(result: unknown): string {
  return ((result as { content: Array<{ text: string }> }).content[0]).text;
}

describe('bundle packaging: @uvrn/probability is an external optional peer', () => {
  beforeAll(() => {
    if (!existsSync(path.join(distDir, 'index.js'))) {
      throw new Error('dist/index.js not found. Run the build before tests.');
    }
  });

  it('dist/index.js loads @uvrn/probability at runtime instead of inlining it', () => {
    const js = readFileSync(path.join(distDir, 'index.js'), 'utf-8');
    expect(js).toMatch(/(?:require|import)\(["']@uvrn\/probability["']\)/);
    // The probability implementation itself must not be in the bundle.
    expect(js).not.toMatch(/function runProbability\b/);
    // Every other @uvrn/* runtime stays bundled (self-contained server).
    const requiredUvrn = [...js.matchAll(/(?:require|import)\(["'](@uvrn\/[^"']+)["']\)/g)].map(
      (m) => m[1]
    );
    expect([...new Set(requiredUvrn)]).toEqual(['@uvrn/probability']);
  });

  it('package.json declares only @uvrn/probability as an (optional) peer', () => {
    const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf-8'));
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(['@uvrn/probability']);
    expect(pkg.peerDependenciesMeta).toEqual({ '@uvrn/probability': { optional: true } });
  });

  it('public dist/index.d.ts is self-contained (no @uvrn/* or MCP SDK type imports)', () => {
    const dts = readFileSync(path.join(distDir, 'index.d.ts'), 'utf-8');
    expect(dts).toMatch(/createServer/);
    expect(dts).toMatch(/RuntimeConfig/);
    // No module specifiers at all: every referenced type is inlined.
    expect(dts).not.toMatch(/\bfrom\s+["']/);
    expect(dts).not.toMatch(/\bimport\s*\(\s*["']/);
    expect(dts).not.toMatch(/\brequire\s*\(/);
  });

  describe('host WITHOUT @uvrn/probability', () => {
    let host: { dir: string; entry: string };
    let client: Client;

    beforeAll(async () => {
      host = makeHost(false);
      client = await connect(host.entry);
    }, 20000);

    afterAll(async () => {
      await client?.close();
      rmSync(host.dir, { recursive: true, force: true });
    });

    it('still lists all 14 tools', async () => {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(14);
      expect(tools.map((t) => t.name)).toContain('delta_prob_run');
    });

    it('delta_prob_run returns a clean optional-peer error', async () => {
      const result = await client.callTool({
        name: 'delta_prob_run',
        arguments: sportsbook.input as Record<string, unknown>,
      });
      expect(result.isError).toBe(true);
      const body = JSON.parse(text(result));
      expect(body.code).toBe('EXECUTION_ERROR');
      expect(body.error).toBe(
        'delta_prob_run requires the optional peer @uvrn/probability — install it on the host.'
      );
      expect(body.details).toMatchObject({ peer: '@uvrn/probability', install: 'npm install @uvrn/probability' });
      expect(text(result)).not.toMatch(/\n\s+at /); // no stack trace
      expect(text(result)).not.toMatch(/requireStack|Require stack/);
      expect(text(result)).not.toMatch(/(\/Users\/|\/home\/|node_modules|[A-Z]:\\)/); // no host paths
    });

    it('other tools keep working', async () => {
      const result = await client.callTool({
        name: 'delta_run_engine',
        arguments: { bundle: createTestBundle() },
      });
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(text(result))).toHaveProperty('receipt');
    });
  });

  describe('host WITH @uvrn/probability', () => {
    let host: { dir: string; entry: string };
    let client: Client;

    beforeAll(async () => {
      host = makeHost(true);
      client = await connect(host.entry);
    }, 20000);

    afterAll(async () => {
      await client?.close();
      rmSync(host.dir, { recursive: true, force: true });
    });

    it('delta_prob_run uses the installed peer and reproduces the golden probabilityHash', async () => {
      const result = await client.callTool({
        name: 'delta_prob_run',
        arguments: sportsbook.input as Record<string, unknown>,
      });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(text(result));
      expect(body.probabilityHash).toBe(sportsbook.expected.probabilityHash);
      expect(body.probabilityHash).toBe(
        'sha256:b3f5690acd3347105babbf708eaaa88f31d83a120d7c3910c14b576a8cea836f'
      );
    });
  });
});
