import type {
  FarmResult as AgentFarmResult,
  FarmSource as AgentFarmSource,
} from '@uvrn/agent';

export type { ClaimRegistration, FarmConnector } from '@uvrn/agent';

/** Explicit source position supplied by a producer (D1, ADR-011). */
export type StanceLabel =
  | 'supports'
  | 'opposes'
  | 'mixed'
  | 'neutral'
  | 'insufficient';

/**
 * Additive farm source shape. Stance is first-class input and is never inferred
 * from title or snippet text (ADR-011).
 */
export interface FarmSource extends AgentFarmSource {
  stanceValue?: number;
  stanceLabel?: StanceLabel;
  stanceConfidence?: number;
  stanceEvidence?: string;
}

export interface FarmResult extends Omit<AgentFarmResult, 'sources'> {
  sources: FarmSource[];
}

export interface ConnectorConfig {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  /**
   * Maximum number of outbound requests allowed per sliding 60-second window.
   * When unset, no rate limit is enforced (default behavior).
   */
  rateLimitPerMinute?: number;
  /**
   * Number of consecutive request failures before the circuit breaker opens.
   * While open, requests reject immediately with {@link CircuitOpenError}.
   * Defaults to 5.
   */
  circuitBreakerThreshold?: number;
  /**
   * Milliseconds the circuit stays open before transitioning to half-open,
   * at which point a single probe request is allowed through. Defaults to 30_000.
   */
  circuitBreakerResetMs?: number;
  /**
   * Injectable clock returning the current epoch milliseconds. Used by the
   * rate limiter and circuit breaker; defaults to `Date.now`. Override in
   * tests to advance time without sleeping.
   */
  now?: () => number;
}

export interface MultiFarmOptions {
  timeoutMs?: number;
  failFast?: boolean;
}

export class FarmConnectorError extends Error {
  readonly connectorName: string;
  override readonly cause?: unknown;

  constructor(connectorName: string, message: string, cause?: unknown) {
    super(`[${connectorName}] ${message}`);
    this.name = 'FarmConnectorError';
    this.connectorName = connectorName;
    this.cause = cause;
  }
}

/**
 * Thrown when a request would exceed the connector's configured
 * `rateLimitPerMinute`. The request is rejected before any network I/O.
 */
export class RateLimitError extends FarmConnectorError {
  /** The configured per-minute limit that was hit. */
  readonly limit: number;
  /** Milliseconds until the oldest in-window request expires and a slot frees up. */
  readonly retryAfterMs: number;

  constructor(connectorName: string, limit: number, retryAfterMs: number) {
    super(connectorName, `Rate limit of ${limit} requests/minute exceeded; retry in ${retryAfterMs}ms`);
    this.name = 'RateLimitError';
    this.limit = limit;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown when the connector's circuit breaker is open (or a half-open probe
 * is already in flight). The request is rejected before any network I/O.
 */
export class CircuitOpenError extends FarmConnectorError {
  /** Milliseconds until the circuit transitions to half-open and allows a probe. */
  readonly retryAfterMs: number;

  constructor(connectorName: string, retryAfterMs: number) {
    super(connectorName, `Circuit breaker is open; retry in ${retryAfterMs}ms`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}
