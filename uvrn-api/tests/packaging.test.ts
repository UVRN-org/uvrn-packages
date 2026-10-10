/**
 * Packaging regressions: bin shebang, default logger without pino-pretty,
 * and health/version endpoints reporting the real package version.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createServer, buildLoggerOptions } from '../src/server';
import type { ServerConfig } from '../src/config/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string; bin: Record<string, string> };

const config: ServerConfig = {
  port: 0,
  host: '127.0.0.1',
  nodeEnv: 'test',
  logLevel: 'fatal',
  corsOrigins: ['*'],
  rateLimitMax: 100,
  rateLimitTimeWindow: '1m',
};

describe('@uvrn/api packaging', () => {
  it('bin entry source starts with a node shebang', () => {
    expect(pkg.bin['uvrn-api']).toBe('dist/server.js');
    const src = readFileSync(join(__dirname, '..', 'src', 'server.ts'), 'utf8');
    expect(src.startsWith('#!/usr/bin/env node\n')).toBe(true);
  });

  it('development logger falls back to plain JSON when pino-pretty is not installed', () => {
    const missing = (): string => {
      throw new Error('Cannot find module pino-pretty');
    };
    const opts = buildLoggerOptions({ ...config, nodeEnv: 'development' }, missing);
    expect(opts.transport).toBeUndefined();
  });

  it('development logger uses pino-pretty when it is resolvable', () => {
    const opts = buildLoggerOptions({ ...config, nodeEnv: 'development' }, () => '/x/pino-pretty');
    expect(opts.transport).toEqual(expect.objectContaining({ target: 'pino-pretty' }));
  });

  it('health and version endpoints report the package.json version', async () => {
    const server = await createServer(config);
    try {
      const health = await server.inject({ method: 'GET', url: '/api/v1/health' });
      expect(health.json().version).toBe(pkg.version);
      const version = await server.inject({ method: 'GET', url: '/api/v1/version' });
      expect(version.json().apiVersion).toBe(pkg.version);
    } finally {
      await server.close();
    }
  });
});
