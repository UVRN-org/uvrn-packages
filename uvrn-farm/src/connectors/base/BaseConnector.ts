import { PROFILES, type ClaimRegistration, type FarmConnector, type FarmResult } from '@uvrn/agent';

import { type ConnectorConfig, FarmConnectorError } from '../../types';

export abstract class BaseConnector implements FarmConnector {
  abstract readonly name: string;
  protected readonly config: Required<Pick<ConnectorConfig, 'timeout' | 'maxRetries'>> & ConnectorConfig;

  constructor(config: ConnectorConfig = {}) {
    this.config = {
      timeout: 10_000,
      maxRetries: 3,
      ...config,
    };
  }

  abstract fetch(claim: ClaimRegistration): Promise<FarmResult>;

  protected claimFromString(claim: string): ClaimRegistration {
    return {
      id: claim,
      label: claim,
      query: claim,
      driftConfig: PROFILES.default,
      intervalMs: 60_000,
    };
  }

  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = this.config.maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this.sleep(200 * (2 ** attempt));
        }
      }
    }

    throw new FarmConnectorError(this.name, 'Max retries exceeded', lastError);
  }

  protected async withTimeout<T>(fn: () => Promise<T>, ms?: number): Promise<T> {
    const timeout = ms ?? this.config.timeout;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new FarmConnectorError(this.name, `Timed out after ${timeout}ms`));
      }, timeout);

      void fn()
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

  protected async requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    return this.withRetry(async () =>
      this.withTimeout(async () => {
        const response = await fetch(url, init);

        if (!response.ok) {
          throw new FarmConnectorError(this.name, `Request failed with status ${response.status}`);
        }

        return response.json() as Promise<T>;
      })
    );
  }

  protected buildResult(claim: ClaimRegistration, sources: FarmResult['sources'], startedAt: number): FarmResult {
    return {
      claimId: claim.id,
      sources,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  }

  protected requireApiKey(): string {
    if (!this.config.apiKey) {
      throw new FarmConnectorError(this.name, 'Missing required apiKey');
    }

    return this.config.apiKey;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
