/**
 * Regression: createServer must succeed when pino-pretty is not available.
 * Mocks the logger module to return level-only config (no transport), then
 * asserts createServer() and health route work.
 */
jest.mock('../src/logger', () => ({
  buildLoggerOptions: (config: { logLevel: string }) => ({ level: config.logLevel })
}));

import { createServer } from '../src/server';

const minimalConfig = {
  port: 3000,
  host: '0.0.0.0',
  corsOrigins: ['*'] as string[],
  rateLimitMax: 100,
  rateLimitTimeWindow: '1 minute',
  logLevel: 'info' as const,
  nodeEnv: 'development' as const
};

describe('createServer with no pino-pretty (mocked logger)', () => {
  test('createServer succeeds and GET /api/v1/health returns 200', async () => {
    const server = await createServer({ ...minimalConfig, nodeEnv: 'development' });
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    await server.close();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('uptime');
  });
});
