/**
 * Configuration Loader
 * Loads and validates server configuration from environment variables
 */

import { ServerConfig, ConfigValidationError } from './types';

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): ServerConfig {
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitTimeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
    logLevel: (process.env.LOG_LEVEL as ServerConfig['logLevel']) || 'info',
    nodeEnv: (process.env.NODE_ENV as ServerConfig['nodeEnv']) || 'development'
  };

  const errors = validateConfig(config);
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Configuration validation failed: ${errorMessages}`);
  }

  return config;
}

/**
 * Validate configuration values
 */
function validateConfig(config: ServerConfig): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (config.port < 1 || config.port > 65535) {
    errors.push({ field: 'port', message: 'Must be between 1 and 65535' });
  }

  if (!config.host) {
    errors.push({ field: 'host', message: 'Host cannot be empty' });
  }

  if (config.rateLimitMax < 1) {
    errors.push({ field: 'rateLimitMax', message: 'Must be at least 1' });
  }

  const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  if (!validLogLevels.includes(config.logLevel)) {
    errors.push({ field: 'logLevel', message: `Must be one of: ${validLogLevels.join(', ')}` });
  }

  const validNodeEnvs = ['development', 'production', 'test'];
  if (!validNodeEnvs.includes(config.nodeEnv)) {
    errors.push({ field: 'nodeEnv', message: `Must be one of: ${validNodeEnvs.join(', ')}` });
  }

  return errors;
}
