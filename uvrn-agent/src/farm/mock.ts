// ─────────────────────────────────────────────────────────────
// @uvrn/agent — MockFarmConnector
// ─────────────────────────────────────────────────────────────

import type { FarmConnector, FarmResult, ClaimRegistration } from '../types/index';

interface MockSource {
  url:         string;
  title:       string;
  snippet:     string;
  publishedAt: string;
  credibility: number;
}

interface MockScenario {
  sources:      MockSource[];
  durationMs?:  number;
  shouldFail?:  boolean;
}

export class MockFarmConnector implements FarmConnector {
  private scenarios = new Map<string, MockScenario>();
  private defaultSourceCount: number;

  constructor(defaultSourceCount = 5) {
    this.defaultSourceCount = defaultSourceCount;
  }

  setScenario(claimId: string, scenario: MockScenario): this {
    this.scenarios.set(claimId, scenario);
    return this;
  }

  async fetch(claim: ClaimRegistration): Promise<FarmResult> {
    const scenario = this.scenarios.get(claim.id);
    const delay = scenario?.durationMs ?? 80 + Math.random() * 120;
    await sleep(delay);

    if (scenario?.shouldFail) {
      throw new Error(`[MockFARM] simulated failure for claim ${claim.id}`);
    }

    const sources = scenario?.sources ?? this.generateSources(claim, this.defaultSourceCount);

    return {
      claimId:    claim.id,
      sources,
      fetchedAt:  new Date().toISOString(),
      durationMs: delay,
    };
  }

  private generateSources(claim: ClaimRegistration, count: number): MockSource[] {
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => ({
      url:         `https://source-${i + 1}.example.com/article-${claim.id}`,
      title:       `${claim.label} — Source ${i + 1}`,
      snippet:     `This source discusses the claim: "${claim.query}" with supporting evidence.`,
      publishedAt: new Date(now - i * 6 * 60 * 60 * 1000).toISOString(),
      credibility: 60 + Math.random() * 35,
    }));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
