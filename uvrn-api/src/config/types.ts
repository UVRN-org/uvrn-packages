/**
 * Server Configuration Types
 */

export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitTimeWindow: string;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  nodeEnv: 'development' | 'production' | 'test';
  /**
   * Optional API key protecting the delta routes (`/api/v1/delta/*`).
   * When set, requests must present it via `Authorization: Bearer <key>`
   * or `X-UVRN-API-Key: <key>` (same convention as the UVRN worker).
   * Health/version routes stay open. When unset (and `apiKeys` empty),
   * the API is open — exactly the pre-4.0 behavior.
   * Env: `UVRN_API_KEY`.
   */
  apiKey?: string;
  /**
   * Optional list of accepted API keys (e.g. for key rotation). Merged
   * with `apiKey` when both are set. Env: `UVRN_API_KEYS` (comma-separated).
   */
  apiKeys?: string[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
}
