/**
 * Every @uvrn/* package whose types appear in the published declarations must be a declared,
 * NON-optional peer — otherwise a strict TS consumer of a solo install hits TS2307
 * (release test B29). The runtime needs none of them; the public types do.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

const imported = new Set<string>();
for (const file of sourceFiles(join(__dirname, '..', 'src'))) {
  for (const m of readFileSync(file, 'utf8').matchAll(/from\s+'(@uvrn\/[^'/]+)'/g)) imported.add(m[1]);
}

describe('@uvrn/test peer metadata', () => {
  it('imports at least the canon, drift and agent surfaces', () => {
    expect([...imported].sort()).toEqual(expect.arrayContaining(['@uvrn/agent', '@uvrn/canon', '@uvrn/drift']));
  });

  it.each([...imported].sort())('%s is a declared, non-optional peer', (name) => {
    expect(pkg.peerDependencies?.[name]).toBe('^5.1.0');
    expect(pkg.peerDependenciesMeta?.[name]?.optional ?? false).toBe(false);
  });
});
