/**
 * Logger options builder for Fastify/Pino.
 * In development, uses pino-pretty only if resolvable; otherwise falls back to standard pino.
 */

import { ServerConfig } from './config/types';

export type ResolveFn = (id: string) => string;

const PRETTY_OPTIONS = {
  translateTime: 'HH:MM:ss Z',
  ignore: 'pid,hostname'
};

export interface LoggerOptions {
  level: string;
  transport?: { target: string; options: typeof PRETTY_OPTIONS };
}

/**
 * Build Pino logger options for Fastify. In development, uses pino-pretty
 * only if the module is resolvable; otherwise uses level-only config so
 * createServer() never crashes due to missing pino-pretty.
 *
 * @param config - Server config (nodeEnv, logLevel)
 * @param resolve - Optional resolver (default: require.resolve). Inject a throwing
 *   function in tests to simulate missing pino-pretty.
 */
export function buildLoggerOptions(
  config: ServerConfig,
  resolve: ResolveFn = (id: string): string => require.resolve(id)
): LoggerOptions {
  const base: LoggerOptions = { level: config.logLevel };
  if (config.nodeEnv !== 'development') {
    return base;
  }
  try {
    resolve('pino-pretty');
    return {
      ...base,
      transport: { target: 'pino-pretty', options: PRETTY_OPTIONS }
    };
  } catch {
    return base;
  }
}
