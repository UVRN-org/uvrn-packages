/**
 * Unit tests for logger options builder.
 * Ensures development pretty transport is optional and fallback does not throw.
 */

import { buildLoggerOptions } from '../src/logger';
import { ServerConfig } from '../src/config/types';

const baseConfig: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  corsOrigins: ['*'],
  rateLimitMax: 100,
  rateLimitTimeWindow: '1 minute',
  logLevel: 'info',
  nodeEnv: 'development'
};

describe('buildLoggerOptions', () => {
  test('production mode returns level only (no transport)', () => {
    const config: ServerConfig = { ...baseConfig, nodeEnv: 'production' };
    const options = buildLoggerOptions(config);
    expect(options.level).toBe('info');
    expect(options.transport).toBeUndefined();
  });

  test('development with pino-pretty resolvable returns transport', () => {
    const options = buildLoggerOptions(baseConfig);
    expect(options.level).toBe('info');
    expect(options.transport).toBeDefined();
    expect(options.transport?.target).toBe('pino-pretty');
    expect(options.transport?.options).toEqual(
      expect.objectContaining({ translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' })
    );
  });

  test('development without pino-pretty (resolver throws) falls back to level only', () => {
    const resolveThatThrows = (): string => {
      throw new Error('Cannot find module \'pino-pretty\'');
    };
    const options = buildLoggerOptions(baseConfig, resolveThatThrows);
    expect(options.level).toBe('info');
    expect(options.transport).toBeUndefined();
  });

  test('test mode returns level only (no transport)', () => {
    const config: ServerConfig = { ...baseConfig, nodeEnv: 'test' };
    const options = buildLoggerOptions(config);
    expect(options.level).toBe('info');
    expect(options.transport).toBeUndefined();
  });
});
