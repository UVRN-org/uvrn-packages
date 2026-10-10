import { VISUAL_PACKAGE_VERSION } from '../src/types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };

test('VISUAL_PACKAGE_VERSION matches package.json', () => {
  expect(VISUAL_PACKAGE_VERSION).toBe(pkg.version);
});
