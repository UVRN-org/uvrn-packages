import type { ClaimRegistration, FarmConnector, FarmResult } from '@uvrn/agent';

import { type ConnectorConfig, CircuitOpenError, FarmConnectorError, RateLimitError } from '../../types';
import { defaultClaimRegistration } from '../../internal/defaultClaimRegistration';

const RATE_LIMIT_WINDOW_MS = 60_000;

export abstract class BaseConnector implements FarmConnector {
  abstract readonly name: string;
  protected readonly config: Required<
    Pick<ConnectorConfig, 'timeout' | 'maxRetries' | 'circuitBreakerThreshold' | 'circuitBreakerResetMs'>
  > & ConnectorConfig;

  /** Injectable clock (epoch ms) — defaults to `Date.now`. */
  private readonly now: () => number;
  /** Timestamps of requests made inside the current sliding 60s window. */
  private requestTimestamps: number[] = [];
  /** Consecutive request failures while the circuit is closed. */
  private consecutiveFailures = 0;
  /** Epoch ms at which the circuit opened, or `null` when closed. */
  private circuitOpenedAt: number | null = null;
  /** True while the single half-open probe request is in flight. */
  private halfOpenProbeInFlight = false;

  constructor(config: ConnectorConfig = {}) {
    this.config = {
      timeout: 10_000,
      maxRetries: 3,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs: 30_000,
      ...config,
    };
    this.now = config.now ?? Date.now;
  }

  abstract fetch(claim: ClaimRegistration): Promise<FarmResult>;

  protected claimFromString(claim: string): ClaimRegistration {
    return defaultClaimRegistration(claim);
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
    return this.withGuards(async () =>
      this.withRetry(async () =>
        this.withTimeout(async () => {
          const response = await fetch(url, init);

          if (!response.ok) {
            throw new FarmConnectorError(this.name, `Request failed with status ${response.status}`);
          }

          return response.json() as Promise<T>;
        })
      )
    );
  }

  /**
   * Runs `fn` behind the connector's circuit breaker and rate limiter.
   *
   * Rejects with {@link CircuitOpenError} (without invoking `fn`) while the
   * circuit is open, and with {@link RateLimitError} when the call would
   * exceed `rateLimitPerMinute` within the sliding 60-second window. Each
   * guarded call consumes one rate-limit slot. A guarded failure counts
   * toward `circuitBreakerThreshold` (default 5 consecutive failures open
   * the circuit); after `circuitBreakerResetMs` (default 30 000 ms) the
   * circuit goes half-open and admits a single probe — success closes the
   * circuit, failure reopens it.
   *
   * `requestJson()` is wrapped automatically; custom connectors that bypass
   * `requestJson()` can wrap their own I/O with this helper.
   */
  protected async withGuards<T>(fn: () => Promise<T>): Promise<T> {
    const isProbe = this.checkCircuit();

    try {
      this.enforceRateLimit();
      const value = await fn();
      this.recordSuccess();
      return value;
    } catch (error) {
      if (error instanceof RateLimitError) {
        // A rate-limited call never reached the network; release the probe
        // slot (if held) without counting a breaker failure.
        if (isProbe) {
          this.halfOpenProbeInFlight = false;
        }
        throw error;
      }

      this.recordFailure(isProbe);
      throw error;
    }
  }

  /**
   * Validates circuit state before a request. Throws {@link CircuitOpenError}
   * while open; returns `true` when this call is the half-open probe.
   */
  private checkCircuit(): boolean {
    if (this.circuitOpenedAt == null) {
      return false;
    }

    const elapsed = this.now() - this.circuitOpenedAt;
    const remaining = this.config.circuitBreakerResetMs - elapsed;

    if (remaining > 0) {
      throw new CircuitOpenError(this.name, remaining);
    }

    if (this.halfOpenProbeInFlight) {
      throw new CircuitOpenError(this.name, this.config.circuitBreakerResetMs);
    }

    this.halfOpenProbeInFlight = true;
    return true;
  }

  /**
   * Throws {@link RateLimitError} when another request would exceed the
   * configured `rateLimitPerMinute`; otherwise records the request timestamp.
   * No-op when `rateLimitPerMinute` is not configured.
   */
  private enforceRateLimit(): void {
    const limit = this.config.rateLimitPerMinute;
    if (limit == null) {
      return;
    }

    const now = this.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp > windowStart);

    if (this.requestTimestamps.length >= limit) {
      const oldest = this.requestTimestamps[0] ?? now;
      throw new RateLimitError(this.name, limit, oldest + RATE_LIMIT_WINDOW_MS - now);
    }

    this.requestTimestamps.push(now);
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
    this.halfOpenProbeInFlight = false;
  }

  private recordFailure(wasProbe: boolean): void {
    if (wasProbe) {
      // Failed half-open probe: reopen for a full reset period.
      this.halfOpenProbeInFlight = false;
      this.circuitOpenedAt = this.now();
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.circuitOpenedAt = this.now();
      this.consecutiveFailures = 0;
    }
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
