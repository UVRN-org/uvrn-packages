import type { FastifyInstance } from 'fastify';

import { CLAIM_LIBRARY, MOCK_PROVIDER_SCENARIOS, SERIES_LIBRARY, getProviderSources } from './fixtures';

function parseTick(input: unknown): number {
  const value = typeof input === 'string' ? Number.parseInt(input, 10) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveScenario(claimId: string, provider: string) {
  return MOCK_PROVIDER_SCENARIOS.find((item) => item.claimId === claimId && item.provider === provider);
}

export async function registerMockIngestRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', async () => ({
    status: 'ok',
    service: 'mock-ingest',
    timestamp: new Date().toISOString(),
  }));

  server.get('/providers/:provider/search', async (request) => {
    const params = request.params as { provider: string };
    const query = request.query as { claimId?: string; tick?: string };
    const claimId = query.claimId ?? CLAIM_LIBRARY.btcReserves.claimId;
    const tick = parseTick(query.tick);
    const scenario = resolveScenario(claimId, params.provider);
    if (scenario) {
      await wait(scenario.latencyMs);
    }

    return {
      provider: params.provider,
      claimId,
      tick,
      scenario,
      sources: getProviderSources(claimId, params.provider, tick),
    };
  });

  server.get('/providers/:provider/assets', async (request) => {
    const params = request.params as { provider: string };
    const query = request.query as { claimId?: string; tick?: string };
    const claimId = query.claimId ?? CLAIM_LIBRARY.btcReserves.claimId;
    const tick = parseTick(query.tick);
    const scenario = resolveScenario(claimId, params.provider);
    if (scenario) {
      await wait(scenario.latencyMs);
    }

    return {
      provider: params.provider,
      claimId,
      tick,
      scenario,
      assets: getProviderSources(claimId, params.provider, tick),
    };
  });

  server.get('/providers/:provider/articles', async (request) => {
    const params = request.params as { provider: string };
    const query = request.query as { claimId?: string; tick?: string };
    const claimId = query.claimId ?? CLAIM_LIBRARY.btcReserves.claimId;
    const tick = parseTick(query.tick);
    const scenario = resolveScenario(claimId, params.provider);
    if (scenario) {
      await wait(scenario.latencyMs);
    }

    return {
      provider: params.provider,
      claimId,
      tick,
      scenario,
      articles: getProviderSources(claimId, params.provider, tick),
    };
  });

  server.get('/claims/:claimId/sources', async (request) => {
    const params = request.params as { claimId: string };
    const query = request.query as { provider?: string; tick?: string };
    const provider = query.provider ?? 'coingecko';
    const tick = parseTick(query.tick);
    const scenario = resolveScenario(params.claimId, provider);
    if (scenario) {
      await wait(scenario.latencyMs);
    }

    return {
      claimId: params.claimId,
      provider,
      tick,
      scenario,
      sources: getProviderSources(params.claimId, provider, tick),
    };
  });

  server.get('/claims/:claimId/series', async (request) => {
    const params = request.params as { claimId: string };
    return {
      claimId: params.claimId,
      series: SERIES_LIBRARY[params.claimId] ?? [],
    };
  });
}
