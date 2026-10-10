/**
 * Packaging regressions: require() must resolve to the CommonJS entry (not the
 * browser IIFE bundle), types condition first, UMD bundle still reachable, and
 * React peers are required because the main entry imports react/jsx-runtime.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  main: string;
  exports: Record<string, string | Record<string, string>>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

describe('@uvrn/embed packaging', () => {
  it('exports "." puts types first and require resolves to the CJS main entry', () => {
    const root = pkg.exports['.'] as Record<string, string>;
    expect(Object.keys(root)[0]).toBe('types');
    expect(root.types).toBe('./dist/index.d.ts');
    const requireTarget = root.require ?? root.default;
    expect(requireTarget).toBe('./' + pkg.main);
    expect(requireTarget).not.toMatch(/umd/);
  });

  it('keeps the UMD bundle reachable for script-tag users', () => {
    expect(pkg.exports['./umd']).toBe('./dist/embed.umd.js');
    expect(pkg.exports['./dist/embed.umd.js']).toBe('./dist/embed.umd.js');
    // Sibling declaration so TS consumers of the subpath do not hit TS7016.
    const build = readFileSync(join(__dirname, '..', 'build-umd.mjs'), 'utf8');
    expect(build).toContain('dist/embed.umd.d.ts');
  });

  it('does not mark react / react-dom as optional peers', () => {
    expect(pkg.peerDependencies.react).toBe('>=17.0.0');
    expect(pkg.peerDependencies['react-dom']).toBe('>=17.0.0');
    expect(pkg.peerDependenciesMeta?.react?.optional).not.toBe(true);
    expect(pkg.peerDependenciesMeta?.['react-dom']?.optional).not.toBe(true);
  });

  it('ConsensusBadge does not rely on the global JSX namespace', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'components', 'ConsensusBadge.tsx'), 'utf8');
    expect(src).not.toMatch(/\bJSX\.Element\b/);
  });
});
