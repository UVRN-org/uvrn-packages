/**
 * Configuration Management
 * Loads configuration from environment variables
 */

import { ServerConfig } from './types';

export function loadConfig(): ServerConfig {
  const logLevel = (process.env.LOG_LEVEL || 'info') as ServerConfig['logLevel'];
  
  // Validate log level
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be one of: ${validLevels.join(', ')}`);
  }

  return {
    logLevel,
    storagePath: process.env.STORAGE_PATH,
    maxBundleSize: process.env.MAX_BUNDLE_SIZE 
      ? parseInt(process.env.MAX_BUNDLE_SIZE, 10) 
      : 10485760, // 10MB default
    verboseErrors: process.env.VERBOSE_ERRORS === 'true',
  };
}

export const config = loadConfig();
