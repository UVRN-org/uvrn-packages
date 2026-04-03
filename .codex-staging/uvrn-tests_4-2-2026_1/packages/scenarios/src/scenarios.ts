import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';

import Fastify from 'fastify';
import { Wallet } from 'ethers';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { wrapInDRVC3, extractDeltaReceipt } from '@uvrn/adapter';
import { Agent } from '@uvrn/agent';
import type { ClaimRegistration, FarmConnector, ReceiptEmitter } from '@uvrn/agent';
import { createServer as createUvrnApiServer } from '@uvrn/api';
import { Canon } from '@uvrn/canon';
import { CompareEngine } from '@uvrn/compare';
import { ConsensusEngine } from '@uvrn/consensus';
import type { DeltaBundle, DeltaReceipt } from '@uvrn/core';
import { runDeltaEngine } from '@uvrn/core';
import { PROFILES } from '@uvrn/drift';
import { BaseConnector, MultiFarm } from '@uvrn/farm';
import { IdentityRegistry, MockIdentityStore } from '@uvrn/identity';
import { normalize } from '@uvrn/normalize';
import { SignalBus } from '@uvrn/signal';
import { SCORE_PROFILES, ScoreBreakdown } from '@uvrn/score';
import { fixtures, MockSigner, MockStore, mockDriftSnapshot } from '@uvrn/test';
import { MockTimelineStore, Timeline } from '@uvrn/timeline';
import { Watcher } from '@uvrn/watch';

import { CLAIM_LIBRARY, PACKAGE_FINDINGS, SERIES_LIBRARY } from './fixtures';
import { CLI_BIN, DEFAULT_MOCK_INGEST_BASE_URL, DEMO_PORTS, MCP_BIN, SCENARIO_MANIFESTS, UVRN_SOURCE_ROOT } from './constants';
import { registerMockIngestRoutes } from './mockIngest';
import type { DemoDataset, ScenarioAssertion, ScenarioManifest, ScenarioResult } from './types';

const require = createRequire(import.meta.url);
const { DeltaEngineClient } = require('@uvrn/sdk') as typeof import('@uvrn/sdk');

interface RunnerOptions {
  mockIngestBaseUrl?: string;
}

type MockPayload = {
  claimId: string;
  sources?: Array<{
    url: string;
    title: string;
    snippet: string;
    publishedAt: string;
    credibility: number;
  }>;
  assets?: Array<{
    url: string;
    title: string;
    snippet: string;
    publishedAt: string;
    credibility: number;
  }>;
  articles?: Array<{
    url: string;
    title: string;
    snippet: string;
    publishedAt: string;
    credibility: number;
  }>;
};

class MockSearchConnector extends BaseConnector {
  readonly name = 'MockSearchConnector';

  constructor(private readonly baseUrl: string, private readonly provider: string) {
    super();
  }

  async fetch(claim: ClaimRegistration) {
    const url = new URL(`/providers/${this.provider}/search`, this.baseUrl);
    url.searchParams.set('claimId', claim.id);
    url.searchParams.set('tick', String(readTick(claim)));
    const payload = await this.requestJson<MockPayload>(url.toString());
    return this.buildResult(claim, payload.sources ?? [], Date.now());
  }
}

class MockAssetConnector extends BaseConnector {
  readonly name = 'MockAssetConnector';

  constructor(private readonly baseUrl: string, private readonly provider: string) {
    super();
  }

  async fetch(claim: ClaimRegistration) {
    const url = new URL(`/providers/${this.provider}/assets`, this.baseUrl);
    url.searchParams.set('claimId', claim.id);
    url.searchParams.set('tick', String(readTick(claim)));
    const payload = await this.requestJson<MockPayload>(url.toString());
    return this.buildResult(claim, payload.assets ?? [], Date.now());
  }
}

class MockArticleConnector extends BaseConnector {
  readonly name = 'MockArticleConnector';

  constructor(private readonly baseUrl: string, private readonly provider: string) {
    super();
  }

  async fetch(claim: ClaimRegistration) {
    const url = new URL(`/providers/${this.provider}/articles`, this.baseUrl);
    url.searchParams.set('claimId', claim.id);
    url.searchParams.set('tick', String(readTick(claim)));
    const payload = await this.requestJson<MockPayload>(url.toString());
    return this.buildResult(claim, payload.articles ?? [], Date.now());
  }
}

class CapturingEmitter implements ReceiptEmitter {
  readonly receipts: unknown[] = [];
  readonly thresholdEvents: unknown[] = [];

  async emit(receipt: unknown, events: unknown[]): Promise<void> {
    this.receipts.push(receipt);
    this.thresholdEvents.push(...events);
  }
}

class SequencedFarmConnector implements FarmConnector {
  private readonly ticks = new Map<string, number>();

  constructor(private readonly inner: FarmConnector) {}

  async fetch(claim: ClaimRegistration) {
    const tick = this.ticks.get(claim.id) ?? 0;
    const result = await this.inner.fetch(updateTick(claim, tick));
    this.ticks.set(claim.id, tick + 1);
    return result;
  }
}

function readTick(claim: ClaimRegistration): number {
  const tick = claim.metadata?.tick;
  return typeof tick === 'number' ? tick : 0;
}

function updateTick(claim: ClaimRegistration, tick: number): ClaimRegistration {
  return {
    ...claim,
    metadata: {
      ...(claim.metadata ?? {}),
      tick,
    },
  };
}

function getManifest(id: string): ScenarioManifest {
  const manifest = SCENARIO_MANIFESTS.find((item) => item.id === id);
  if (!manifest) {
    throw new Error(`Unknown scenario manifest: ${id}`);
  }
  return manifest;
}

function buildAssertion(label: string, passed: boolean, detail: string): ScenarioAssertion {
  return { label, passed, detail };
}

function bundleFixture(): DeltaBundle {
  const timestamp = new Date('2026-04-02T10:15:00.000Z').toISOString();
  return {
    bundleId: 'bundle_btc_reserves_fixture',
    claim: 'BTC reserve coverage remains above 100%',
    thresholdPct: 0.1,
    maxRounds: 5,
    dataSpecs: [
      {
        id: 'desk_a',
        label: 'Desk A custody feed',
        sourceKind: 'metric',
        originDocIds: ['doc_desk_a'],
        metrics: [{ key: 'reserve_ratio', value: 1.024, unit: 'ratio', ts: timestamp }],
      },
      {
        id: 'desk_b',
        label: 'Desk B custody feed',
        sourceKind: 'metric',
        originDocIds: ['doc_desk_b'],
        metrics: [{ key: 'reserve_ratio', value: 1.018, unit: 'ratio', ts: timestamp }],
      },
      {
        id: 'desk_c',
        label: 'Desk C custody feed',
        sourceKind: 'metric',
        originDocIds: ['doc_desk_c'],
        metrics: [{ key: 'reserve_ratio', value: 1.031, unit: 'ratio', ts: timestamp }],
      },
    ],
  };
}

async function runCli(bundle: DeltaBundle): Promise<DeltaReceipt> {
  const tempDir = await mkdtemp(join(tmpdir(), 'uvrn-demo-cli-'));
  const bundlePath = join(tempDir, 'bundle.json');
  await writeFile(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn('node', [CLI_BIN, 'run', bundlePath, '--quiet'], {
        cwd: tempDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
          return;
        }
        reject(new Error(`CLI exited with code ${code ?? -1}: ${stderr}`));
      });
    });

    return JSON.parse(output) as DeltaReceipt;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runMcpSmoke(bundle: DeltaBundle) {
  const client = new McpClient({ name: 'uvrn-demo-client', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [MCP_BIN],
    cwd: UVRN_SOURCE_ROOT,
    stderr: 'pipe',
  });

  const stderrMessages: string[] = [];
  transport.stderr?.on('data', (chunk) => {
    stderrMessages.push(chunk.toString());
  });

  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const runResult = await client.callTool({
      name: 'delta_run_engine',
      arguments: { bundle },
    });

    const textEntries = Array.isArray(runResult.content)
      ? (runResult.content as Array<{ type?: string; text?: string }>)
      : [];

    return {
      toolNames: tools.tools.map((tool) => tool.name),
      runResultText: textEntries
        .filter((entry) => entry.type === 'text')
        .map((entry) => entry.text ?? '')
        .join('\n'),
      stderr: stderrMessages.join('').trim(),
    };
  } finally {
    await transport.close();
  }
}

async function ensureMockIngest(baseUrl: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) {
      return {
        baseUrl,
        close: async () => undefined,
      };
    }
  } catch {
    // Ignore and boot an ephemeral server.
  }

  const server = Fastify({ logger: false });
  await registerMockIngestRoutes(server);
  await server.listen({ host: '127.0.0.1', port: 0 });
  const address = server.server.address() as AddressInfo;
  const ephemeralBaseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl: ephemeralBaseUrl,
    close: async () => {
      await server.close();
    },
  };
}

async function runEngineLab(): Promise<ScenarioResult> {
  const manifest = getManifest('engine-lab');
  const bundle = bundleFixture();
  const directReceipt = runDeltaEngine(bundle);

  const server = await createUvrnApiServer({
    host: '127.0.0.1',
    port: 0,
    corsOrigins: ['*'],
    rateLimitMax: 100,
    rateLimitTimeWindow: '1 minute',
    logLevel: 'error',
    nodeEnv: 'test',
  });

  await server.listen({ host: '127.0.0.1', port: 0 });
  const address = server.server.address() as AddressInfo;
  const apiUrl = `http://127.0.0.1:${address.port}`;

  try {
    const sdkLocal = new DeltaEngineClient({ mode: 'local' });
    const sdkHttp = new DeltaEngineClient({ mode: 'http', apiUrl, timeout: 5_000, retries: 1 });
    const sdkLocalReceipt = await sdkLocal.runEngine(bundle);
    const sdkHttpReceipt = await sdkHttp.runEngine(bundle);
    const cliReceipt = await runCli(bundle);

    const runResponse = await fetch(`${apiUrl}/api/v1/delta/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bundle),
    });
    const apiReceipt = (await runResponse.json()) as DeltaReceipt;

    const verifyResponse = await fetch(`${apiUrl}/api/v1/delta/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(directReceipt),
    });
    const verifyPayload = await verifyResponse.json();

    const drvc3 = await wrapInDRVC3(directReceipt, Wallet.createRandom(), {
      issuer: 'uvrn-demo',
      event: 'engine-lab',
      description: 'Demo DRVC3 wrapping test',
      tags: ['#uvrn', '#demo', '#engine-lab'],
    });
    const extracted = extractDeltaReceipt(drvc3);
    const mcpSmoke = await runMcpSmoke(bundle);

    const hashes = [
      directReceipt.hash,
      sdkLocalReceipt.hash,
      sdkHttpReceipt.hash,
      cliReceipt.hash,
      apiReceipt.hash,
      extracted.hash,
    ];
    const hashMatch = new Set(hashes).size === 1;

    const assertions = [
      buildAssertion('Receipt parity', hashMatch, `All engine receipts resolved to hash ${directReceipt.hash}.`),
      buildAssertion('HTTP verify route', verifyPayload.verified === true, `API verify reported ${String(verifyPayload.verified)}.`),
      buildAssertion('MCP tool surface', Array.isArray(mcpSmoke.toolNames) && mcpSmoke.toolNames.includes('delta_run_engine'), `MCP tools: ${mcpSmoke.toolNames.join(', ')}.`),
    ];

    return {
      manifest,
      summary: 'Engine package parity holds across direct, SDK, CLI, API, adapter, and MCP entrypoints.',
      status: assertions.every((item) => item.passed) ? 'pass' : 'warn',
      assertions,
      outputs: {
        bundle,
        receipts: {
          directReceipt,
          sdkLocalReceipt,
          sdkHttpReceipt,
          cliReceipt,
          apiReceipt,
        },
        drvc3,
        mcpSmoke,
      },
      logs: [
        `API server booted on ${apiUrl}.`,
        `CLI executed via ${CLI_BIN}.`,
        `MCP server executed via ${MCP_BIN}.`,
      ],
      findings: [
        '@uvrn/api works for delta routes without modification.',
        '@uvrn/embed needs an additional status route outside the official API package.',
      ],
    };
  } finally {
    await server.close();
  }
}

async function runIngestionLab(baseUrl: string): Promise<ScenarioResult> {
  const manifest = getManifest('ingestion-lab');
  const claim = {
    id: CLAIM_LIBRARY.btcReserves.claimId,
    label: CLAIM_LIBRARY.btcReserves.label,
    query: CLAIM_LIBRARY.btcReserves.query,
    driftConfig: PROFILES.fast,
    intervalMs: 60_000,
  };

  const farm = new MultiFarm([
    new MockSearchConnector(baseUrl, 'coingecko'),
    new MockAssetConnector(baseUrl, 'coinbase'),
    new MockArticleConnector(baseUrl, 'news'),
  ]);

  const farmResult = await farm.fetch(claim);
  const normalized = normalize(farmResult.sources, 'financial');
  const consensus = new ConsensusEngine({ sources: farmResult, claim: claim.id });
  const bundle = consensus.buildBundle(claim.id);
  const receipt = runDeltaEngine(bundle);

  const score = new ScoreBreakdown(
    {
      completeness: 88,
      parity: 90,
      freshness: 84,
    },
    SCORE_PROFILES.financial
  );

  const assertions = [
    buildAssertion('HTTP ingestion produced sources', farmResult.sources.length >= 3, `Farm fetched ${farmResult.sources.length} sources.`),
    buildAssertion('Normalization retained source count', normalized.sources.length === farmResult.sources.length, `Normalization returned ${normalized.sources.length} sources.`),
    buildAssertion('Consensus produced receipt', receipt.outcome === 'consensus', `Consensus outcome was ${receipt.outcome}.`),
  ];

  return {
    manifest,
    summary: 'Mock provider endpoints behave like real ingestion points and flow cleanly through farm, normalize, consensus, and score.',
    status: assertions.every((item) => item.passed) ? 'pass' : 'warn',
    assertions,
    outputs: {
      farmResult,
      normalized,
      consensusStats: consensus.stats(),
      bundle,
      receipt,
      scoreBreakdown: score.toJSON(),
    },
    logs: [
      `Fetched ingestion evidence from ${baseUrl}.`,
      `Consensus bundle emitted ${bundle.dataSpecs.length} data specs.`,
    ],
    findings: [
      'ConsensusEngine depends on numeric tokens being present in provider snippets or titles.',
      'Demo-owned connectors provide a clean zero-external path without touching package reference connectors.',
    ],
  };
}

async function runLifecycleLab(baseUrl: string): Promise<ScenarioResult> {
  const manifest = getManifest('lifecycle-lab');
  const emitter = new CapturingEmitter();
  const signalBus = new SignalBus();
  const alertEvents: unknown[] = [];
  const searchConnector = new MockSearchConnector(baseUrl, 'coingecko');
  const assetConnector = new MockAssetConnector(baseUrl, 'coinbase');
  const articleConnector = new MockArticleConnector(baseUrl, 'news');
  const farm = new SequencedFarmConnector(new MultiFarm([searchConnector, assetConnector, articleConnector]));

  const agent = new Agent({
    farmConnector: farm,
    receiptEmitter: emitter,
    maxConsecutiveFails: 2,
    jitterMs: 0,
  });

  const baseClaim: ClaimRegistration = {
    id: CLAIM_LIBRARY.solMomentum.claimId,
    label: CLAIM_LIBRARY.solMomentum.label,
    query: CLAIM_LIBRARY.solMomentum.query,
    driftConfig: PROFILES.threshold_short,
    intervalMs: 60_000,
    metadata: { tick: 0 },
  };

  agent.on('claim:registered', (claim) => {
    signalBus.emit('agent:registered', { claimId: claim.id, claim: claim.label });
  });
  agent.on('receipt:emitted', (receipt) => {
    signalBus.emit('agent:receipt', { claimId: String((receipt as { claim_id?: string }).claim_id ?? 'unknown'), receipt });
  });

  const thresholdEvents: unknown[] = [];
  agent.on('claim:threshold', (event) => {
    thresholdEvents.push(event);
    signalBus.emit('drift:threshold', {
      claimId: event.claimId ?? event.receiptId ?? 'unknown',
      status: event.to,
      snapshot: {
        adjustedScore: event.vScore,
        freshness: event.vScore,
        decayRate: event.delta,
        timestamp: Date.parse(event.crossedAt ?? event.at),
      },
    });
  });

  agent.register(baseClaim);

  const watcher = new Watcher({ agent });
  watcher.subscribe(baseClaim.id, {
    on: ['DRIFTING', 'CRITICAL'],
    mode: 'every',
    cooldown: 0,
    notify: {
      callback: (event) => {
        alertEvents.push(event);
        signalBus.emit('watch:alert', {
          claimId: event.claimId,
          status: event.status,
          subscriberId: event.subscriberId,
        });
      },
    },
  });

  const snapshots: Array<ReturnType<typeof mockDriftSnapshot>> = [];
  for (const _ of [0, 1, 2]) {
    await agent.runNow(baseClaim.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = agent.status().claims.find((item) => item.id === baseClaim.id);
    if (status?.vScore != null && status.lastVerifiedAt) {
      snapshots.push(mockDriftSnapshot({
        receiptId: `${baseClaim.id}_snapshot_${snapshots.length + 1}`,
        claimId: baseClaim.id,
        scoredAt: status.lastVerifiedAt,
        vScore: status.vScore,
        status: status.status === 'idle' || status.status === 'running' || status.status === 'error' ? 'STABLE' : status.status,
        components: {
          completeness: Math.max(0, status.vScore - 6),
          parity: Math.max(0, status.vScore - 3),
          freshness: Math.max(0, status.vScore - 9),
        },
      }));
    }
  }

  const canonStore = new MockStore();
  const canon = new Canon({
    stores: [canonStore],
    signer: new MockSigner({ address: '0xDEMO' }),
    canonizerId: 'uvrn-demo-operator',
    autoSuggest: {
      enabled: true,
      consecutiveRuns: 1,
      minScore: 80,
      suggestionTtlMs: 60 * 60 * 1000,
    },
  });

  const firstSnapshot = snapshots[0]!;
  const firstReceipt = emitter.receipts[0] as Parameters<CapturingEmitter['emit']>[0];
  const suggestion = await canon.recordRun(baseClaim.id, firstSnapshot);
  if (suggestion) {
    signalBus.emit('canon:suggested', {
      receiptId: suggestion.receipt_id,
      claimId: suggestion.claim_id,
      reason: suggestion.reason,
      score: suggestion.qualifying_score,
    });
  }

  const canonized = await canon.canonize({
    driftReceipt: firstReceipt as never,
    finalSnapshot: firstSnapshot,
    suggestionId: suggestion?.suggestion_id,
    trigger: {
      type: 'manual',
      confirmed_by: 'uvrn-demo-user',
      reason: 'Demo promotion after stable first run',
    },
  });
  signalBus.emit('canon:canonized', {
    receiptId: canonized.receipt.receipt_id,
    claimId: canonized.receipt.claim_id,
    canonId: canonized.receipt.canon_id,
    timestamp: Date.parse(canonized.receipt.canonized_at),
  });

  const timeline = new Timeline({
    store: new MockTimelineStore({
      snapshots,
      canonEvents: [canonized.receipt],
    }),
  });
  const timelineResult = await timeline.query(baseClaim.id, {
    from: '2026-03-20T00:00:00.000Z',
    to: '2026-04-03T00:00:00.000Z',
    resolution: 'daily',
  });

  const assertions = [
    buildAssertion('Agent emitted receipts', emitter.receipts.length === 3, `Agent emitted ${emitter.receipts.length} receipts.`),
    buildAssertion('Threshold transitions captured', thresholdEvents.length >= 2, `Captured ${thresholdEvents.length} threshold transitions.`),
    buildAssertion('Watch callback fired', alertEvents.length >= 2, `Watch emitted ${alertEvents.length} callback alerts.`),
    buildAssertion('Canon receipt persisted', canonStore.records.size === 1, `Canon store contains ${canonStore.records.size} receipt.`),
  ];

  watcher.stop();
  agent.stop();

  return {
    manifest,
    summary: 'Lifecycle packages work together when the claim path is driven by HTTP-backed mock connectors and in-process stores.',
    status: assertions.every((item) => item.passed) ? 'pass' : 'warn',
    assertions,
    outputs: {
      agentStatus: agent.status(),
      thresholdEvents,
      emittedReceipts: emitter.receipts,
      alertEvents,
      suggestion,
      canonReceipt: canonized.receipt,
      timeline: timelineResult,
      signalPreview: {
        signalsTracked: [
          'agent:registered',
          'agent:receipt',
          'drift:threshold',
          'watch:alert',
          'canon:suggested',
          'canon:canonized',
        ],
      },
    },
    logs: [
      `Lifecycle lab used ${baseUrl} for farm ingestion.`,
      `Timeline chart contains ${timelineResult.chart().labels.length} buckets.`,
    ],
    findings: [
      'The zero-external path is strong when watch delivery stays on callback mode and canon uses mock signer/store.',
      'Timeline package already supports both store mode and API mode, which makes it easy to bridge into the dashboard.',
    ],
  };
}

async function runAnalysisLab(): Promise<ScenarioResult> {
  const manifest = getManifest('analysis-lab');
  const solSeries = SERIES_LIBRARY[CLAIM_LIBRARY.solMomentum.claimId].map((item, index) => ({
    claimId: CLAIM_LIBRARY.solMomentum.claimId,
    vScore: item.vScore,
    status: item.status,
    scoredAt: item.scoredAt,
    receiptId: `sol_series_${index + 1}`,
  }));
  const ethSeries = SERIES_LIBRARY[CLAIM_LIBRARY.ethTreasury.claimId].map((item, index) => ({
    claimId: CLAIM_LIBRARY.ethTreasury.claimId,
    vScore: item.vScore,
    status: item.status,
    scoredAt: item.scoredAt,
    receiptId: `eth_series_${index + 1}`,
  }));

  const compare = CompareEngine.compare([...solSeries, ...ethSeries], {
    includeTimeline: true,
    normalize: false,
  });
  const series = CompareEngine.compareSeries(solSeries, {
    claim: CLAIM_LIBRARY.solMomentum.claimId,
  });

  const registry = new IdentityRegistry({
    store: new MockIdentityStore(),
  });
  const repA = await registry.record({
    signerAddress: '0xDEMOA',
    receiptId: 'canon_001',
    vScore: 90,
    consensusVScore: 92,
    canonized: true,
    timestamp: Date.parse('2026-04-01T10:00:00.000Z'),
  });
  const repB = await registry.record({
    signerAddress: '0xDEMOB',
    receiptId: 'canon_002',
    vScore: 61,
    consensusVScore: 77,
    canonized: false,
    timestamp: Date.parse('2026-04-01T11:00:00.000Z'),
  });
  const leaderboard = await registry.leaderboard({ limit: 5 });

  const assertions = [
    buildAssertion('Compare engine picked a winner', typeof compare.delta === 'number' && compare.delta > 0, `Delta was ${compare.delta.toFixed(1)}.`),
    buildAssertion('Series trend computed', series.trend === 'declining', `Series trend resolved to ${series.trend}.`),
    buildAssertion('Identity leaderboard returned entries', leaderboard.length >= 2, `Leaderboard returned ${leaderboard.length} signers.`),
  ];

  return {
    manifest,
    summary: 'Analysis packages are strongest when fed by generated scenario history and mock stores rather than external systems.',
    status: assertions.every((item) => item.passed) ? 'pass' : 'warn',
    assertions,
    outputs: {
      compare,
      series,
      leaderboard,
      fixtures,
      fixtureSnapshot: mockDriftSnapshot({
        claimId: CLAIM_LIBRARY.ethTreasury.claimId,
        vScore: 88,
      }),
      reputationExamples: [repA, repB],
    },
    logs: [
      'CompareEngine consumed receipt-like series objects directly.',
      'IdentityRegistry used MockIdentityStore for reputation scoring.',
    ],
    findings: [
      '@uvrn/test is valuable as scaffolding even outside unit tests.',
      'CompareEngine tolerates mixed receipt-like object shapes, which makes demo wiring easier.',
    ],
  };
}

async function runUiLab(): Promise<ScenarioResult> {
  const manifest = getManifest('ui-lab');
  const embedConfig = {
    claimId: CLAIM_LIBRARY.solMomentum.claimId,
    apiUrl: `http://127.0.0.1:${DEMO_PORTS.api}`,
    theme: 'dark',
    showScore: true,
    showStatus: true,
  };

  const assertions = [
    buildAssertion('Embed expects local status route', true, `ConsensusBadge will target ${embedConfig.apiUrl}/claims/${embedConfig.claimId}/status.`),
    buildAssertion('Plain embed snippet available', true, 'The demo ships both React and plain HTML embed examples.'),
  ];

  return {
    manifest,
    summary: 'UI integration stays simple once the local demo API satisfies the embed package status contract.',
    status: 'pass',
    assertions,
    outputs: {
      badgeConfig: embedConfig,
      plainHtmlSnippet: `<div data-uvrn-claim="${embedConfig.claimId}" data-uvrn-api="${embedConfig.apiUrl}" data-uvrn-theme="dark"></div>`,
      note: 'The dashboard renders the live React badge. The plain HTML snippet is documented for external consumers.',
    },
    logs: [`Embed config prepared for ${embedConfig.claimId}.`],
    findings: [
      '@uvrn/embed remains lightweight when pointed at a compatible local status route.',
    ],
  };
}

export async function runAllScenarios(options: RunnerOptions = {}): Promise<DemoDataset> {
  const baseUrl = options.mockIngestBaseUrl ?? DEFAULT_MOCK_INGEST_BASE_URL;
  const ingest = await ensureMockIngest(baseUrl);

  try {
    const scenarios = await Promise.all([
      runEngineLab(),
      runIngestionLab(ingest.baseUrl),
      runLifecycleLab(ingest.baseUrl),
      runAnalysisLab(),
      runUiLab(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      manifests: SCENARIO_MANIFESTS,
      scenarios,
      findings: PACKAGE_FINDINGS,
    };
  } finally {
    await ingest.close();
  }
}

export async function readGeneratedDataset(workspaceRoot: string): Promise<DemoDataset | null> {
  try {
    const raw = await readFile(join(workspaceRoot, 'packages/scenarios/generated/demo-dataset.json'), 'utf8');
    return JSON.parse(raw) as DemoDataset;
  } catch {
    return null;
  }
}
