/**
 * Simple Logger for MCP Server
 * Respects LOG_LEVEL configuration
 */

import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: number;

  constructor(levelName: LogLevel = 'info') {
    this.level = levels[levelName];
  }

  private shouldLog(level: LogLevel): boolean {
    return levels[level] >= this.level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.error('[DEBUG]', message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.error('[INFO]', message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', message, ...args);
    }
  }
}

export const logger = new Logger(config.logLevel);
