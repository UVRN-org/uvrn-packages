import { PROFILES } from '@uvrn/agent';
import type { ClaimRegistration, FarmConnector, FarmResult } from '../types';
import { type MultiFarmOptions, FarmConnectorError } from '../types';

function claimFromString(claim: string): ClaimRegistration {
  return {
    id: claim,
    label: claim,
    query: claim,
    driftConfig: PROFILES.default,
    intervalMs: 60_000,
  };
}

function connectorName(connector: FarmConnector & { name?: string }): string {
  return connector.name ?? connector.constructor.name ?? 'AnonymousConnector';
}

export class MultiFarm implements FarmConnector {
  private readonly connectors = new Map<string, FarmConnector & { name?: string }>();
  private readonly options: Required<Pick<MultiFarmOptions, 'timeoutMs' | 'failFast'>>;

  constructor(connectors: Array<FarmConnector & { name?: string }>, options: MultiFarmOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? 10_000,
      failFast: options.failFast ?? false,
    };

    for (const connector of connectors) {
      this.add(connector);
    }
  }

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? claimFromString(claim) : claim;
    const startedAt = Date.now();
    const connectorEntries = Array.from(this.connectors.entries());

    if (connectorEntries.length === 0) {
      return {
        claimId: registration.id,
        sources: [],
        fetchedAt: new Date().toISOString(),
        durationMs: 0,
      };
    }

    const pending = connectorEntries.map(([name, connector]) =>
      this.runWithTimeout(name, connector.fetch(registration))
    );

    const settled = await Promise.allSettled(pending);
    const sources: FarmResult['sources'] = [];

    for (let index = 0; index < settled.length; index += 1) {
      const result = settled[index];

      if (result.status === 'fulfilled') {
        sources.push(...result.value.sources);
        continue;
      }

      const [name] = connectorEntries[index];
      const reason = result.reason instanceof Error
        ? result.reason
        : new FarmConnectorError(name, 'Connector execution failed', result.reason);

      if (this.options.failFast) {
        throw reason;
      }
    }

    return {
      claimId: registration.id,
      sources,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  }

  add(connector: FarmConnector & { name?: string }): void {
    this.connectors.set(connectorName(connector), connector);
  }

  remove(name: string): void {
    this.connectors.delete(name);
  }

  list(): string[] {
    return Array.from(this.connectors.keys());
  }

  private async runWithTimeout(name: string, promise: Promise<FarmResult>): Promise<FarmResult> {
    return new Promise<FarmResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new FarmConnectorError(name, `Timed out after ${this.options.timeoutMs}ms`));
      }, this.options.timeoutMs);

      void promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
