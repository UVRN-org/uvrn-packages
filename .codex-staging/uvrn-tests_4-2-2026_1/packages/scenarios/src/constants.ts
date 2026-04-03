import type { ScenarioManifest } from './types';

export const UVRN_SOURCE_ROOT =
  '/Users/stsdev1/Documents/SuttleMedia/SuttleMediaLLC/UVRN/uvrn-packages_main/uvrn-packages-next-2/uvrn-packages-next-2';

export const CLI_BIN = `${UVRN_SOURCE_ROOT}/uvrn-cli/dist/cli.js`;
export const MCP_BIN = `${UVRN_SOURCE_ROOT}/uvrn-mcp/dist/index.js`;

export const DEMO_PORTS = {
  web: 4173,
  api: 4174,
  mockIngest: 4175,
};

export const DEFAULT_MOCK_INGEST_BASE_URL = `http://127.0.0.1:${DEMO_PORTS.mockIngest}`;

export const SCENARIO_MANIFESTS: ScenarioManifest[] = [
  {
    id: 'engine-lab',
    title: 'Engine Lab',
    summary: 'Cross-check core, SDK, CLI, API, adapter, and MCP behavior against the same bundle.',
    packages: ['@uvrn/core', '@uvrn/sdk', '@uvrn/cli', '@uvrn/api', '@uvrn/adapter', '@uvrn/mcp'],
    mode: 'engine',
  },
  {
    id: 'ingestion-lab',
    title: 'Ingestion Lab',
    summary: 'Fetch mock provider data over HTTP and run farm, normalize, consensus, and score flows.',
    packages: ['@uvrn/farm', '@uvrn/normalize', '@uvrn/consensus', '@uvrn/score'],
    mode: 'ingestion',
  },
  {
    id: 'lifecycle-lab',
    title: 'Lifecycle Lab',
    summary: 'Drive drift, agent, signal, watch, canon, and timeline from mock-ingested claim changes.',
    packages: ['@uvrn/drift', '@uvrn/agent', '@uvrn/signal', '@uvrn/watch', '@uvrn/canon', '@uvrn/timeline'],
    mode: 'lifecycle',
  },
  {
    id: 'analysis-lab',
    title: 'Analysis Lab',
    summary: 'Compare claim histories, score signer reputation, and use @uvrn/test fixtures as setup accelerators.',
    packages: ['@uvrn/compare', '@uvrn/identity', '@uvrn/test'],
    mode: 'analysis',
  },
  {
    id: 'ui-lab',
    title: 'UI Lab',
    summary: 'Render @uvrn/embed against the local claim status route and document the plain embed path.',
    packages: ['@uvrn/embed'],
    mode: 'ui',
  },
];
