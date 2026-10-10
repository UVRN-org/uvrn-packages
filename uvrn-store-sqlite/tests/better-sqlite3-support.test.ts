/**
 * better-sqlite3 11.x ships no Node 26 prebuild and fails to compile there, so a clean
 * workspace install on Node 26 broke. 12.10.0 is the first release whose engines include 26.x.
 * The optional peer range stays permissive so Node 18 consumers can keep using 11.x.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { openUvrnDatabase } from '../src';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  peerDependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const parse = (v: string): number[] => v.replace(/^[\^~]/, '').split('.').map(Number);
const atLeast = (v: string, min: string): boolean => {
  const a = parse(v);
  const b = parse(min);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

describe('better-sqlite3 version support', () => {
  it('develops against a release that supports Node 26 (>= 12.10.0)', () => {
    expect(atLeast(pkg.devDependencies['better-sqlite3'], '12.10.0')).toBe(true);
  });

  it('keeps the optional peer range open to 11.x and 12.x', () => {
    const alternatives = pkg.peerDependencies['better-sqlite3'].split('||').map((s) => s.trim());
    expect(alternatives).toEqual(expect.arrayContaining(['^11.0.0', '^12.0.0']));
  });

  it('installed better-sqlite3 declares support for the running Node major', () => {
    const installed = JSON.parse(
      readFileSync(require.resolve('better-sqlite3/package.json'), 'utf8'),
    ) as { version: string; engines?: { node?: string } };
    expect(atLeast(installed.version, '12.10.0')).toBe(true);
    const major = process.versions.node.split('.')[0];
    expect(installed.engines?.node?.split('||').map((s) => s.trim())).toContain(`${major}.x`);
  });

  it('opens the default (better-sqlite3) driver', () => {
    const db = openUvrnDatabase(':memory:');
    try {
      expect(db.raw.prepare('select 1 as one').get()).toEqual({ one: 1 });
    } finally {
      db.close();
    }
  });
});
