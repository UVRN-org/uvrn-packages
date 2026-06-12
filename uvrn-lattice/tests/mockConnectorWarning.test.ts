// The synthetic-data warning state is a module-level once-per-process flag, so each test
// loads a fresh copy of the module via jest.isolateModules + require.
type MockConnectorModule = typeof import('../src/connectors/MockDomainConnector');

function constructInIsolatedModule(times: number): void {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MockDomainConnector } = require('../src/connectors/MockDomainConnector') as MockConnectorModule;
    for (let index = 0; index < times; index += 1) {
      void new MockDomainConnector();
    }
  });
}

describe('MockDomainConnector synthetic-data warning', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Simulate a non-test process: both guards must be cleared.
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalJestWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }
    warnSpy.mockRestore();
  });

  it('warns exactly once per process outside test environments', () => {
    constructInIsolatedModule(2);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SYNTHETIC data'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[uvrn-lattice]'));
  });

  it('stays silent when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';

    constructInIsolatedModule(1);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('stays silent inside a Jest worker (JEST_WORKER_ID set)', () => {
    process.env.JEST_WORKER_ID = '1';

    constructInIsolatedModule(1);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
