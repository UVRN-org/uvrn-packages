import { CHART_PACKAGE_VERSION } from '../src/types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };

test('CHART_PACKAGE_VERSION matches package.json', () => {
  expect(CHART_PACKAGE_VERSION).toBe(pkg.version);
});
