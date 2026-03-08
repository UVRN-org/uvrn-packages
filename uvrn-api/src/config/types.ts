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
}

export interface ConfigValidationError {
  field: string;
  message: string;
}
