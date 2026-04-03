import type { ClaimRegistration, FarmConnector, FarmResult } from '@uvrn/agent';

import { mockFarmResult } from '../factories/farm.factory';
import type { MockFarmConnectorOptions } from '../types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toClaimRegistration(claim: string): ClaimRegistration {
  return {
    id: claim,
    label: claim,
    query: claim,
    driftConfig: {
      weights: { completeness: 0.35, parity: 0.35, freshness: 0.3 },
      thresholds: { drifting: 80, critical: 60 },
      curve: 'LINEAR',
      rate: 1,
    },
    intervalMs: 60_000,
  };
}

export class MockFarmConnector implements FarmConnector {
  readonly calls: string[] = [];
  private readonly latencyMs: number;
  private readonly presetSources;

  constructor(options: MockFarmConnectorOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.presetSources = options.sources;
  }

  get callCount(): number {
    return this.calls.length;
  }

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? toClaimRegistration(claim) : claim;
    this.calls.push(registration.id);

    if (this.latencyMs > 0) {
      await sleep(this.latencyMs);
    }

    return mockFarmResult({
      claimId: registration.id,
      sources: this.presetSources,
      durationMs: this.latencyMs,
    });
  }

  reset(): void {
    this.calls.length = 0;
  }
}
