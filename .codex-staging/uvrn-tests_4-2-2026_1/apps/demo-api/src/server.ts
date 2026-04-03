import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer as createUvrnApiServer } from '@uvrn/api';
import {
  CLAIM_LIBRARY,
  DEMO_PORTS,
  SERIES_LIBRARY,
  readGeneratedDataset,
  runAllScenarios,
  writeArtifacts,
} from '@uvrn-demo/scenarios';
import type { DemoDataset, ScenarioResult } from '@uvrn-demo/scenarios';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, '../..');

let datasetCache: DemoDataset | null = null;

async function loadDataset(): Promise<DemoDataset> {
  if (datasetCache) {
    return datasetCache;
  }

  const existing = await readGeneratedDataset(workspaceRoot);
  if (existing) {
    datasetCache = existing;
    return existing;
  }

  const generated = await runAllScenarios();
  await writeArtifacts(workspaceRoot, generated);
  datasetCache = generated;
  return generated;
}

function scenarioById(dataset: DemoDataset, id: string): ScenarioResult | undefined {
  return dataset.scenarios.find((scenario) => scenario.manifest.id === id);
}

function resolveClaimStatus(dataset: DemoDataset, claimId: string) {
  const lifecycle = scenarioById(dataset, 'lifecycle-lab');
  const timeline = lifecycle?.outputs.timeline as { snapshots?: Array<{ claimId: string; vScore: number; status: string }> } | undefined;
  const matchingSnapshot = timeline?.snapshots?.filter((snapshot) => snapshot.claimId === claimId).at(-1);
  if (matchingSnapshot) {
    return {
      claimId,
      status: matchingSnapshot.status,
      vScore: matchingSnapshot.vScore,
      source: 'lifecycle-timeline',
    };
  }

  const series = SERIES_LIBRARY[claimId];
  if (series?.length) {
    const latest = series.at(-1)!;
    return {
      claimId,
      status: latest.status,
      vScore: latest.vScore,
      source: 'fixture-series',
    };
  }

  return {
    claimId,
    status: 'CRITICAL',
    vScore: 0,
    source: 'missing',
  };
}

async function main(): Promise<void> {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number.parseInt(process.env.PORT ?? String(DEMO_PORTS.api), 10);

  const server = await createUvrnApiServer({
    host,
    port,
    corsOrigins: ['*'],
    rateLimitMax: 250,
    rateLimitTimeWindow: '1 minute',
    logLevel: 'error',
    nodeEnv: 'test',
  });

  server.get('/health', async () => ({
    status: 'ok',
    service: 'demo-api',
    generatedAt: (await loadDataset()).generatedAt,
    timestamp: new Date().toISOString(),
  }));

  server.get('/scenarios', async () => {
    const dataset = await loadDataset();
    return dataset.scenarios.map((scenario) => ({
      id: scenario.manifest.id,
      title: scenario.manifest.title,
      summary: scenario.summary,
      status: scenario.status,
      packages: scenario.manifest.packages,
      assertions: scenario.assertions,
    }));
  });

  server.get('/scenarios/:id', async (request, reply) => {
    const dataset = await loadDataset();
    const params = request.params as { id: string };
    const scenario = scenarioById(dataset, params.id);
    if (!scenario) {
      return reply.code(404).send({ error: 'Scenario not found' });
    }
    return scenario;
  });

  server.get('/claims/:claimId/status', async (request) => {
    const dataset = await loadDataset();
    const params = request.params as { claimId: string };
    return resolveClaimStatus(dataset, params.claimId);
  });

  server.get('/timeline', async (request) => {
    const dataset = await loadDataset();
    const query = request.query as { claimId?: string };
    const claimId = query.claimId ?? CLAIM_LIBRARY.solMomentum.claimId;
    const lifecycle = scenarioById(dataset, 'lifecycle-lab');
    const timeline = lifecycle?.outputs.timeline as { claimId: string } | undefined;
    if (timeline?.claimId === claimId) {
      return timeline;
    }

    return {
      claimId,
      snapshots: (SERIES_LIBRARY[claimId] ?? []).map((item, index) => ({
        receiptId: `${claimId}_series_${index + 1}`,
        claimId,
        scoredAt: item.scoredAt,
        vScore: item.vScore,
        status: item.status,
      })),
      canonEvents: [],
      summary: `Fallback series for ${claimId}.`,
      chart: {
        labels: (SERIES_LIBRARY[claimId] ?? []).map((item) => item.scoredAt),
        vScores: (SERIES_LIBRARY[claimId] ?? []).map((item) => item.vScore),
      },
    };
  });

  server.get('/findings', async () => {
    const dataset = await loadDataset();
    return dataset.findings;
  });

  server.get('/docs/findings', async () => {
    const file = join(workspaceRoot, 'docs/findings.md');
    try {
      return {
        markdown: await readFile(file, 'utf8'),
      };
    } catch {
      return {
        markdown: '# Findings\n\nNo findings document has been generated yet.',
      };
    }
  });

  server.post('/rerun/:scenarioId', async (request, reply) => {
    const params = request.params as { scenarioId: string };
    const nextDataset = await runAllScenarios();
    await writeArtifacts(workspaceRoot, nextDataset);
    datasetCache = nextDataset;

    const scenario = scenarioById(nextDataset, params.scenarioId);
    if (!scenario) {
      return reply.code(404).send({
        error: 'Scenario not found after rerun',
      });
    }

    return {
      rerunAt: nextDataset.generatedAt,
      scenario,
    };
  });

  await server.listen({ host, port });
  console.log(`Demo API running at http://${host}:${port}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
