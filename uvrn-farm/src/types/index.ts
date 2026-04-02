export type {
  ClaimRegistration,
  FarmConnector,
  FarmResult,
  FarmSource,
} from '@uvrn/agent';

export interface ConnectorConfig {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimitPerMinute?: number;
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
