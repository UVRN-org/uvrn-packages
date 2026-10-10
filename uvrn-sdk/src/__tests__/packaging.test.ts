/**
 * Packaging regressions: VERSION tracks package.json and exports support ESM.
 */
import { VERSION } from '../index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json') as {
  version: string;
  exports: Record<string, Record<string, string>>;
};

describe('@uvrn/sdk packaging', () => {
  it('VERSION equals package.json version', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('exports "." lists types first and has an import-capable condition', () => {
    const root = pkg.exports['.'];
    expect(Object.keys(root)[0]).toBe('types');
    expect(root.default ?? root.import).toBe('./dist/index.js');
    expect(root.require ?? root.default).toBe('./dist/index.js');
  });
});
