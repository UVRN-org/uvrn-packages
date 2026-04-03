import type { PackageFinding, MockProviderScenario } from './types';

type SourceSeed = {
  url: string;
  title: string;
  snippet: string;
  publishedAt: string;
  credibility: number;
};

type ProviderTimeline = Record<string, SourceSeed[][]>;

const NOW = new Date('2026-04-02T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

export const CLAIM_LIBRARY = {
  btcReserves: {
    claimId: 'clm_btc_reserves_001',
    label: 'Reserve proof for BTC treasury desk',
    query: 'btc reserve coverage ratio',
  },
  solMomentum: {
    claimId: 'clm_sol_momentum_001',
    label: 'SOL momentum remains stable through the monitoring window',
    query: 'sol momentum verification',
  },
  ethTreasury: {
    claimId: 'clm_eth_treasury_001',
    label: 'ETH treasury liquidity remains healthy',
    query: 'eth treasury liquidity',
  },
};

export const MOCK_PROVIDER_SCENARIOS: MockProviderScenario[] = [
  {
    claimId: CLAIM_LIBRARY.btcReserves.claimId,
    provider: 'coingecko',
    variant: 'stable-consensus',
    responseShape: 'search',
    latencyMs: 30,
  },
  {
    claimId: CLAIM_LIBRARY.btcReserves.claimId,
    provider: 'coinbase',
    variant: 'stable-consensus',
    responseShape: 'assets',
    latencyMs: 20,
  },
  {
    claimId: CLAIM_LIBRARY.btcReserves.claimId,
    provider: 'news',
    variant: 'stable-consensus',
    responseShape: 'articles',
    latencyMs: 35,
  },
  {
    claimId: CLAIM_LIBRARY.solMomentum.claimId,
    provider: 'coingecko',
    variant: 'threshold-shift-sequence',
    responseShape: 'search',
    latencyMs: 25,
  },
  {
    claimId: CLAIM_LIBRARY.solMomentum.claimId,
    provider: 'coinbase',
    variant: 'threshold-shift-sequence',
    responseShape: 'assets',
    latencyMs: 20,
  },
  {
    claimId: CLAIM_LIBRARY.solMomentum.claimId,
    provider: 'news',
    variant: 'threshold-shift-sequence',
    responseShape: 'articles',
    latencyMs: 45,
  },
];

export const PROVIDER_DATA: Record<string, ProviderTimeline> = {
  [CLAIM_LIBRARY.btcReserves.claimId]: {
    coingecko: [
      [
        {
          url: 'https://mock.local/coingecko/btc/desk-a',
          title: 'BTC reserve ratio 100.4 from custody desk A',
          snippet: 'Search evidence reports reserve coverage at 100.4 with narrow spread.',
          publishedAt: hoursAgo(2),
          credibility: 0.91,
        },
        {
          url: 'https://mock.local/coingecko/btc/desk-b',
          title: 'BTC reserve ratio 102.8 from custody desk B',
          snippet: 'Secondary search evidence reports reserve coverage at 102.8.',
          publishedAt: hoursAgo(4),
          credibility: 0.89,
        },
      ],
    ],
    coinbase: [
      [
        {
          url: 'https://mock.local/coinbase/btc/desk-c',
          title: 'BTC reserve ratio 104.9 from balance sheet feed',
          snippet: 'Balance sheet feed publishes reserve coverage at 104.9.',
          publishedAt: hoursAgo(3),
          credibility: 0.86,
        },
      ],
    ],
    news: [
      [
        {
          url: 'https://mock.local/news/btc/desk-d',
          title: 'Analyst note cites reserve ratio 98.7',
          snippet: 'Coverage recap cites the reserve ratio at 98.7 after reconciliation.',
          publishedAt: hoursAgo(6),
          credibility: 0.74,
        },
      ],
    ],
    research: [
      [
        {
          url: 'https://mock.local/research/btc/desk-e',
          title: 'Audit memorandum: reserve ratio 101.6',
          snippet: 'Independent memorandum captures reserve ratio 101.6 with timestamped evidence.',
          publishedAt: hoursAgo(8),
          credibility: 0.8,
        },
      ],
    ],
  },
  [CLAIM_LIBRARY.solMomentum.claimId]: {
    coingecko: [
      [
        {
          url: 'https://mock.local/coingecko/sol/tick0-a',
          title: 'SOL momentum 92.4 at session open',
          snippet: 'Momentum check logs SOL score 92.4 with fresh matching evidence.',
          publishedAt: hoursAgo(1),
          credibility: 0.94,
        },
        {
          url: 'https://mock.local/coingecko/sol/tick0-b',
          title: 'SOL momentum 91.8 on matching venue snapshot',
          snippet: 'Venue snapshot shows SOL momentum 91.8.',
          publishedAt: hoursAgo(1.2),
          credibility: 0.91,
        },
      ],
      [
        {
          url: 'https://mock.local/coingecko/sol/tick1-a',
          title: 'SOL momentum 77.2 after mixed follow-through',
          snippet: 'Mid-session follow-through shows SOL momentum 77.2 with wider timestamp spread.',
          publishedAt: daysAgo(4),
          credibility: 0.78,
        },
      ],
      [
        {
          url: 'https://mock.local/coingecko/sol/tick2-a',
          title: 'SOL momentum 41.5 after stale liquidity read',
          snippet: 'Late-session liquidity read shows SOL momentum at 41.5 with stale evidence.',
          publishedAt: daysAgo(18),
          credibility: 0.58,
        },
      ],
    ],
    coinbase: [
      [
        {
          url: 'https://mock.local/coinbase/sol/tick0-c',
          title: 'SOL momentum 92.1 on exchange depth model',
          snippet: 'Depth model posts SOL momentum 92.1.',
          publishedAt: hoursAgo(0.8),
          credibility: 0.88,
        },
      ],
      [
        {
          url: 'https://mock.local/coinbase/sol/tick1-b',
          title: 'SOL momentum 73.6 on exchange depth model',
          snippet: 'Depth model cools to 73.6.',
          publishedAt: daysAgo(5),
          credibility: 0.71,
        },
      ],
      [
        {
          url: 'https://mock.local/coinbase/sol/tick2-b',
          title: 'SOL momentum 38.8 on impaired depth model',
          snippet: 'Depth model falls to 38.8 with low confidence.',
          publishedAt: daysAgo(22),
          credibility: 0.49,
        },
      ],
    ],
    news: [
      [
        {
          url: 'https://mock.local/news/sol/tick0-d',
          title: 'Analysts keep SOL momentum near 90.7',
          snippet: 'Desk notes keep SOL momentum near 90.7.',
          publishedAt: hoursAgo(2),
          credibility: 0.72,
        },
      ],
      [
        {
          url: 'https://mock.local/news/sol/tick1-c',
          title: 'Analysts drop SOL momentum to 69.4',
          snippet: 'Desk notes revise SOL momentum down to 69.4 and note uncertainty.',
          publishedAt: daysAgo(6),
          credibility: 0.63,
        },
      ],
      [
        {
          url: 'https://mock.local/news/sol/tick2-c',
          title: 'Analysts drop SOL momentum to 34.1',
          snippet: 'Desk notes fall to 34.1 and highlight stale evidence.',
          publishedAt: daysAgo(26),
          credibility: 0.42,
        },
      ],
    ],
    research: [
      [
        {
          url: 'https://mock.local/research/sol/tick0-e',
          title: 'Research baseline 89.9',
          snippet: 'Independent research baseline starts at 89.9.',
          publishedAt: hoursAgo(3),
          credibility: 0.76,
        },
      ],
      [
        {
          url: 'https://mock.local/research/sol/tick1-d',
          title: 'Research baseline 68.1',
          snippet: 'Independent research baseline softens to 68.1.',
          publishedAt: daysAgo(7),
          credibility: 0.59,
        },
      ],
      [
        {
          url: 'https://mock.local/research/sol/tick2-d',
          title: 'Research baseline 32.2',
          snippet: 'Independent research baseline falls to 32.2.',
          publishedAt: daysAgo(29),
          credibility: 0.39,
        },
      ],
    ],
  },
  [CLAIM_LIBRARY.ethTreasury.claimId]: {
    coingecko: [
      [
        {
          url: 'https://mock.local/coingecko/eth/desk-a',
          title: 'ETH treasury liquidity 96.4',
          snippet: 'Treasury desk reads liquidity at 96.4.',
          publishedAt: hoursAgo(2),
          credibility: 0.92,
        },
      ],
    ],
    coinbase: [
      [
        {
          url: 'https://mock.local/coinbase/eth/desk-b',
          title: 'ETH treasury liquidity 95.8',
          snippet: 'Exchange snapshot reads liquidity at 95.8.',
          publishedAt: hoursAgo(4),
          credibility: 0.86,
        },
      ],
    ],
    news: [
      [
        {
          url: 'https://mock.local/news/eth/desk-c',
          title: 'ETH treasury liquidity 94.7',
          snippet: 'Coverage note reads liquidity at 94.7.',
          publishedAt: hoursAgo(8),
          credibility: 0.71,
        },
      ],
    ],
    research: [
      [
        {
          url: 'https://mock.local/research/eth/desk-d',
          title: 'ETH treasury liquidity 95.1',
          snippet: 'Research memo reads liquidity at 95.1.',
          publishedAt: hoursAgo(6),
          credibility: 0.8,
        },
      ],
    ],
  },
};

export function getProviderSources(
  claimId: string,
  provider: string,
  tick = 0
): SourceSeed[] {
  const providerBuckets = PROVIDER_DATA[claimId]?.[provider] ?? [];
  if (providerBuckets.length === 0) {
    return [];
  }

  const index = Math.max(0, Math.min(tick, providerBuckets.length - 1));
  return providerBuckets[index] ?? [];
}

export const SERIES_LIBRARY = {
  [CLAIM_LIBRARY.solMomentum.claimId]: [
    { scoredAt: daysAgo(8), vScore: 92.1, status: 'STABLE' },
    { scoredAt: daysAgo(4), vScore: 74.5, status: 'DRIFTING' },
    { scoredAt: daysAgo(1), vScore: 44.1, status: 'CRITICAL' },
  ],
  [CLAIM_LIBRARY.ethTreasury.claimId]: [
    { scoredAt: daysAgo(8), vScore: 85.6, status: 'STABLE' },
    { scoredAt: daysAgo(4), vScore: 88.7, status: 'STABLE' },
    { scoredAt: daysAgo(1), vScore: 91.2, status: 'STABLE' },
  ],
};

export const PACKAGE_FINDINGS: PackageFinding[] = [
  {
    packageName: '@uvrn/core',
    standalone: true,
    peersRequired: [],
    combinations: ['sdk', 'cli', 'api', 'adapter', 'consensus'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'Core runs cleanly as the deterministic base for bundle validation, execution, and receipt verification.',
    evidence: ['Engine Lab parity checks matched across local, CLI, and HTTP flows.'],
  },
  {
    packageName: '@uvrn/sdk',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['core', 'api', 'cli'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'The SDK works well in local and HTTP modes and is easiest to validate against the same bundle fixture.',
    evidence: ['Engine Lab local and HTTP receipts matched the core receipt hash.'],
  },
  {
    packageName: '@uvrn/cli',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['core', 'sdk', 'api'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'CLI smoke runs are straightforward once the package is built and the bundle is written to disk.',
    evidence: ['Engine Lab CLI JSON output matched the core receipt hash.'],
  },
  {
    packageName: '@uvrn/api',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['core', 'sdk', 'embed'],
    ingressMode: 'direct',
    status: 'verified-with-demo-glue',
    notes: 'Official delta routes work as-is. The demo adds claim status and timeline routes because those are outside the current package surface.',
    evidence: ['Engine Lab HTTP run, validate, and verify routes returned expected results.'],
  },
  {
    packageName: '@uvrn/mcp',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['core'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'The MCP server is smoke-tested over stdio by listing tools and calling delta_run_engine against the shared bundle.',
    evidence: ['Engine Lab MCP smoke completed with tool listing and tool execution.'],
  },
  {
    packageName: '@uvrn/adapter',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['core'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'Adapter wrapping works cleanly around core receipts with a local random wallet and no network requirements.',
    evidence: ['Engine Lab DRVC3 wrapping preserved the embedded delta receipt hash.'],
  },
  {
    packageName: '@uvrn/drift',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['agent', 'canon', 'watch', 'timeline'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'Drift snapshots and threshold events are easy to drive once mock-ingested evidence is converted into agent scores.',
    evidence: ['Lifecycle Lab crossed STABLE -> DRIFTING -> CRITICAL.'],
  },
  {
    packageName: '@uvrn/agent',
    standalone: false,
    peersRequired: ['@uvrn/drift'],
    combinations: ['farm', 'watch', 'signal', 'canon'],
    ingressMode: 'provider-http',
    status: 'verified',
    notes: 'Agent integrations are strongest when farm data arrives through a real connector boundary rather than direct fixtures.',
    evidence: ['Lifecycle Lab used HTTP-backed connectors and emitted threshold events.'],
  },
  {
    packageName: '@uvrn/canon',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/drift'],
    combinations: ['agent', 'timeline', 'test'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'Manual canonization works well with mock signer and store implementations from @uvrn/test.',
    evidence: ['Lifecycle Lab produced a canon receipt and storage proof.'],
  },
  {
    packageName: '@uvrn/signal',
    standalone: true,
    peersRequired: [],
    combinations: ['agent', 'watch', 'canon'],
    ingressMode: 'local-callback',
    status: 'verified',
    notes: 'SignalBus is lightweight and easy to bridge from agent and watch events in-process.',
    evidence: ['Lifecycle Lab emitted agent, drift, canon, and watch signals.'],
  },
  {
    packageName: '@uvrn/score',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['consensus', 'drift'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'ScoreBreakdown is useful as the explanation layer for ingestion and lifecycle outputs.',
    evidence: ['Ingestion Lab produced a score breakdown from normalized components.'],
  },
  {
    packageName: '@uvrn/test',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/drift', '@uvrn/canon'],
    combinations: ['canon', 'compare', 'identity'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'The package is best used as a setup accelerator for demos, tests, and mock signer/store support.',
    evidence: ['Analysis Lab consumed fixtures and mock signer/store helpers.'],
  },
  {
    packageName: '@uvrn/farm',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/agent'],
    combinations: ['normalize', 'consensus', 'agent'],
    ingressMode: 'provider-http',
    status: 'verified-with-demo-glue',
    notes: 'Farm is the clearest place to test provider-style boundaries. Demo-owned connectors keep the default path zero-external.',
    evidence: ['Ingestion Lab fetched mock provider data over local HTTP through BaseConnector-based adapters.'],
  },
  {
    packageName: '@uvrn/normalize',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/agent'],
    combinations: ['farm', 'consensus'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'Normalization fits naturally between farm ingestion and consensus bundle construction.',
    evidence: ['Ingestion Lab normalized HTTP-fetched FarmSource objects into stable output.'],
  },
  {
    packageName: '@uvrn/consensus',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/agent'],
    combinations: ['farm', 'normalize', 'core'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'ConsensusEngine is effective once mock provider snippets carry usable numeric tokens.',
    evidence: ['Ingestion Lab built a DeltaBundle and consensus stats from mock-ingested evidence.'],
  },
  {
    packageName: '@uvrn/compare',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/drift'],
    combinations: ['timeline', 'identity'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'CompareEngine works well on mixed receipt-like shapes and benefits from timeline-aligned data.',
    evidence: ['Analysis Lab compared two claim histories and generated a divergence summary.'],
  },
  {
    packageName: '@uvrn/identity',
    standalone: false,
    peersRequired: ['@uvrn/core'],
    combinations: ['test', 'compare'],
    ingressMode: 'direct',
    status: 'verified',
    notes: 'IdentityRegistry is straightforward to demo with MockIdentityStore and recorded activities.',
    evidence: ['Analysis Lab produced leaderboard-ready reputation output.'],
  },
  {
    packageName: '@uvrn/timeline',
    standalone: false,
    peersRequired: ['@uvrn/core', '@uvrn/drift', '@uvrn/canon'],
    combinations: ['canon', 'agent', 'watch'],
    ingressMode: 'direct',
    status: 'verified-with-demo-glue',
    notes: 'Timeline works locally with MockTimelineStore and can also target a remote API if a compatible route exists.',
    evidence: ['Lifecycle Lab returned sampled snapshots and chart output.'],
  },
  {
    packageName: '@uvrn/watch',
    standalone: false,
    peersRequired: ['@uvrn/agent', '@uvrn/drift'],
    combinations: ['agent', 'signal'],
    ingressMode: 'local-callback',
    status: 'verified',
    notes: 'The in-process callback path is the best default for demos. Third-party delivery targets stay optional.',
    evidence: ['Lifecycle Lab delivered callback alerts without external services.'],
  },
  {
    packageName: '@uvrn/embed',
    standalone: false,
    peersRequired: ['react', 'react-dom'],
    combinations: ['api'],
    ingressMode: 'direct',
    status: 'verified-with-demo-glue',
    notes: 'Embed renders cleanly against a local claim status endpoint. The demo API provides the route expected by the package.',
    evidence: ['UI Lab renders the live badge against /claims/:claimId/status.'],
  },
];
