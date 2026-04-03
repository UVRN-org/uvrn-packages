import type { ClaimRegistration, FarmResult } from '@uvrn/agent';
import { mockFarmResult } from '@uvrn/test';

import {
  BaseConnector,
  CoinbaseFarm,
  CoinGeckoFarm,
  ConnectorRegistry,
  FarmConnectorError,
  MultiFarm,
  NewsApiFarm,
  PerplexityFarm,
} from '../src';

function buildClaimRegistration(overrides: Partial<ClaimRegistration> = {}): ClaimRegistration {
  return {
    id: 'clm_btc_001',
    label: 'Bitcoin',
    query: 'bitcoin',
    driftConfig: {
      name: 'default',
      curve: 'LINEAR',
      rate: 0.15,
      staleAfterHours: 720,
      scoreFloor: 0,
    },
    intervalMs: 60_000,
    ...overrides,
  };
}

function mockFetchJson(payload: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

class StaticConnector extends BaseConnector {
  readonly name: string;
  private readonly result: FarmResult;

  constructor(name: string, result: FarmResult) {
    super();
    this.name = name;
    this.result = result;
  }

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? this.claimFromString(claim) : claim;
    return {
      ...this.result,
      claimId: registration.id,
    };
  }
}

class FailingConnector extends BaseConnector {
  readonly name = 'FailingConnector';

  async fetch(_claim: ClaimRegistration): Promise<FarmResult> {
    throw new FarmConnectorError(this.name, 'Simulated failure');
  }
}

class RetryProbeConnector extends BaseConnector {
  readonly name = 'RetryProbeConnector';
  private attempts = 0;

  async fetch(_claim: ClaimRegistration): Promise<FarmResult> {
    return mockFarmResult();
  }

  async runWithFailuresBeforeSuccess(failuresBeforeSuccess: number): Promise<string> {
    return this.withRetry(async () => {
      this.attempts += 1;

      if (this.attempts <= failuresBeforeSuccess) {
        throw new Error(`attempt-${this.attempts}`);
      }

      return 'ok';
    });
  }

  getAttempts(): number {
    return this.attempts;
  }
}

describe('@uvrn/farm', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CoinGeckoFarm.fetch(claimRegistration) returns a FarmResult with sources', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetchJson({
        coins: [
          { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', market_cap_rank: 1 },
        ],
      }) as unknown as typeof fetch
    );

    const connector = new CoinGeckoFarm();
    const result = await connector.fetch(buildClaimRegistration());

    expect(result.claimId).toBe('clm_btc_001');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.url).toContain('coingecko.com');
  });

  it('CoinbaseFarm.fetch(claimRegistration) returns a FarmResult with sources', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetchJson({
        data: [
          { id: 'BTC', name: 'Bitcoin', min_size: '0.00000001' },
        ],
      }) as unknown as typeof fetch
    );

    const connector = new CoinbaseFarm();
    const result = await connector.fetch(buildClaimRegistration());

    expect(result.claimId).toBe('clm_btc_001');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.title).toContain('Bitcoin');
  });

  it('PerplexityFarm throws FarmConnectorError when no apiKey is provided', async () => {
    const connector = new PerplexityFarm();

    await expect(connector.fetch(buildClaimRegistration()))
      .rejects
      .toThrow('[PerplexityFarm] Missing required apiKey');
  });

  it('NewsApiFarm throws FarmConnectorError when no apiKey is provided', async () => {
    const connector = new NewsApiFarm();

    await expect(connector.fetch(buildClaimRegistration()))
      .rejects
      .toThrow('[NewsApiFarm] Missing required apiKey');
  });

  it('MultiFarm.fetch() fans out in parallel and merges all sources', async () => {
    const claim = buildClaimRegistration();
    const connectorA = new StaticConnector('ConnectorA', mockFarmResult({
      sources: [{ url: 'https://a.example.com', title: 'A', snippet: 'A', credibility: 0.8 }],
    }));
    const connectorB = new StaticConnector('ConnectorB', mockFarmResult({
      sources: [{ url: 'https://b.example.com', title: 'B', snippet: 'B', credibility: 0.7 }],
    }));

    const farm = new MultiFarm([connectorA, connectorB]);
    const result = await farm.fetch(claim);

    expect(result.sources).toHaveLength(2);
    expect(farm.list()).toEqual(['ConnectorA', 'ConnectorB']);
  });

  it('MultiFarm.fetch() gracefully handles one connector failing', async () => {
    const claim = buildClaimRegistration();
    const connectorA = new StaticConnector('ConnectorA', mockFarmResult({
      sources: [{ url: 'https://ok.example.com', title: 'OK', snippet: 'OK', credibility: 0.9 }],
    }));
    const farm = new MultiFarm([connectorA, new FailingConnector()]);

    const result = await farm.fetch(claim);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.url).toBe('https://ok.example.com');
  });

  it('ConnectorRegistry.register() + get() + createMultiFarm() work correctly', async () => {
    const registry = new ConnectorRegistry();
    const connector = new StaticConnector('RegistryConnector', mockFarmResult());

    registry.register(connector);

    expect(registry.get('RegistryConnector')).toBe(connector);
    expect(registry.list()).toEqual(['RegistryConnector']);

    const multi = registry.createMultiFarm();
    const result = await multi.fetch(buildClaimRegistration());

    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('BaseConnector.withRetry() retries up to maxRetries times on failure', async () => {
    const connector = new RetryProbeConnector({ maxRetries: 2 });

    const result = await connector.runWithFailuresBeforeSuccess(2);

    expect(result).toBe('ok');
    expect(connector.getAttempts()).toBe(3);
  });

  it('FarmConnectorError is thrown with the correct connector name in the message', () => {
    const error = new FarmConnectorError('UnitConnector', 'boom');

    expect(error.message).toBe('[UnitConnector] boom');
    expect(error.connectorName).toBe('UnitConnector');
  });
});
