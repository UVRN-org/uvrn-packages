import type { ConnectorContext, DomainConnector, DomainSignal, DomainSpec } from '../types';

const DOMAIN_BASELINES: Record<string, number> = {
  cultural: 64,
  economic: 68,
  technical: 72,
  legal: 58,
  financial: 66,
  scientific: 70,
  seo: 62,
};

// Once-per-process guard for the synthetic-data warning. Module-level by design: a process
// constructing many mock connectors should see the warning exactly once.
let warnedSyntheticData = false;

function warnSyntheticDataOnce(): void {
  if (
    warnedSyntheticData ||
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined
  ) {
    return;
  }

  warnedSyntheticData = true;
  console.warn(
    '[uvrn-lattice] MockDomainConnector is supplying SYNTHETIC data. This is a development stub — wire a real DomainConnector or AsyncClaimClassifier before trusting results.'
  );
}

export class MockDomainConnector implements DomainConnector {
  readonly name = 'MockDomainConnector';

  constructor() {
    warnSyntheticDataOnce();
  }

  async fetch(query: string, domainSpec: DomainSpec, context?: ConnectorContext): Promise<DomainSignal[]> {
    const now = context?.timestamp ?? new Date().toISOString();
    const baseline = DOMAIN_BASELINES[domainSpec.id] ?? 60;
    const queryAdjustment = stableAdjustment(query, domainSpec.id);

    return domainSpec.signalCategories.map((category, index) => {
      const categoryAdjustment = index * 3;
      const value = clampMetric(baseline + queryAdjustment + categoryAdjustment);

      return {
        domainId: domainSpec.id,
        key: category,
        value,
        unit: 'score',
        source: `mock://${domainSpec.id}/${category}`,
        ts: now,
        explanation: `${domainSpec.label} mock signal for ${category} generated without external providers.`,
      };
    });
  }
}

function stableAdjustment(query: string, domainId: string): number {
  const seed = `${query}:${domainId}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return (hash % 9) - 4;
}

function clampMetric(value: number): number {
  return Math.max(0, Math.min(100, value));
}
