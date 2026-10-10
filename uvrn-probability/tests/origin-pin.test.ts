/**
 * Contract origins are pinned: a package release must not move any v1 or v2 golden vector.
 * Simulates a bumped PACKAGE_VERSION by mocking ../src/version, then reruns every v1 and v2
 * vector case against its unchanged expected hashes. `../src` is required only inside the
 * isolation block (no top-level import), so the vectors run against the mocked module.
 *
 * Scope: the mock spreads the real module, so a contract origin derived from PACKAGE_VERSION
 * *inside* version.ts would be computed before the mock applies and slip past the simulated
 * bump. The source-text check below closes that gap: each contract origin must be built from its
 * own literal version constant, never from PACKAGE_VERSION.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalize } from '@uvrn/receipt/canonical';

const BUMPED_ORIGIN = 'model:@uvrn/probability@9.9.9';
const specVectors = (file: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', 'SPEC', 'vectors', file), 'utf8'));
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

type VectorCase = { id: string; input: unknown; options?: { signer?: Record<string, string> }; expected: Record<string, unknown> };

function withBumpedVersion(run: (pkg: typeof import('../src')) => void): void {
  jest.isolateModules(() => {
    jest.doMock('../src/version', () => ({
      ...jest.requireActual('../src/version'),
      PACKAGE_VERSION: '9.9.9',
      PROBABILITY_ORIGIN: BUMPED_ORIGIN,
    }));
    run(require('../src') as typeof import('../src'));
  });
}

function signerFor(vectors: { keys: { privateKeySeed: string } }, c: VectorCase) {
  const s = c.options?.signer;
  return s ? { signer: { privateKey: vectors.keys.privateKeySeed, publicKeyRef: s.publicKeyRef, signedAt: s.signedAt } } : undefined;
}

function expectReproduced(result: { probabilityHash: string; receipt: { receiptHash: string } }, c: VectorCase): void {
  expect(result.probabilityHash).toBe(c.expected.probabilityHash);
  expect(result.receipt.receiptHash).toBe(c.expected.receiptHash);
  expect(sha(canonicalize(result as unknown as Record<string, unknown>))).toBe(c.expected.canonicalResultSha256);
}

afterEach(() => jest.dontMock('../src/version'));

describe('origin pin: contract origins are literal pins in version.ts', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'version.ts'), 'utf8');

  it.each([
    ['LEGACY_PROBABILITY_VERSION', 'LEGACY_PROBABILITY_ORIGIN', '0.1.0'],
    ['FORECAST_V2_VERSION', 'FORECAST_V2_ORIGIN', '0.2.0'],
  ])('%s is the literal %s pin and %s uses it', (versionName, originName, literal) => {
    expect(source).toContain(`export const ${versionName} = '${literal}';`);
    expect(source).toContain('export const ' + originName + ' = `model:@uvrn/probability@${' + versionName + '}`;');
  });

  it('no contract origin is derived from PACKAGE_VERSION', () => {
    const derived = source.split('\n').filter((line) => /_ORIGIN = /.test(line) && line.includes('PACKAGE_VERSION'));
    expect(derived).toEqual(['export const PROBABILITY_ORIGIN = `model:@uvrn/probability@${PACKAGE_VERSION}`;']);
  });
});

describe('origin pin: a simulated package bump moves no golden vector', () => {
  it('the mock reaches the package entry point', () => {
    withBumpedVersion((pkg) => {
      expect(pkg.PACKAGE_VERSION).toBe('9.9.9');
      expect(pkg.PROBABILITY_ORIGIN).toBe(BUMPED_ORIGIN);
      expect(pkg.FORECAST_V2_ORIGIN).toBe('model:@uvrn/probability@0.2.0');
      expect(pkg.LEGACY_PROBABILITY_ORIGIN).toBe('model:@uvrn/probability@0.1.0');
    });
  });

  it('every v1 vector reproduces byte-identically under the bumped version', () => {
    const vectors = specVectors('probability-v1.json');
    withBumpedVersion((pkg) => {
      expect(pkg.PROBABILITY_ORIGIN).toBe(BUMPED_ORIGIN);
      for (const c of vectors.cases as VectorCase[]) {
        expectReproduced(pkg.runProbability(c.input as never, signerFor(vectors, c)), c);
      }
    });
  });

  it('every v2 vector reproduces byte-identically under the bumped version', () => {
    const vectors = specVectors('probability-v2.json');
    withBumpedVersion((pkg) => {
      expect(pkg.PROBABILITY_ORIGIN).toBe(BUMPED_ORIGIN);
      for (const c of vectors.cases as VectorCase[]) {
        expectReproduced(pkg.runForecast(c.input as never, signerFor(vectors, c)), c);
      }
    });
  });
});
