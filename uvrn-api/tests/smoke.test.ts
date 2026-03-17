/**
 * Smoke tests for the API server.
 * Ensures createServer works and health route responds.
 * Covers dev/production logging and regression for missing pino-pretty.
 */

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

describe('API smoke', () => {
  test('createServer returns a Fastify instance', async () => {
    const server = await createServer();
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
    await server.close();
  });

  test('GET /api/v1/health returns 200 and health shape', async () => {
    const server = await createServer();
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    await server.close();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
  });

  test('createServer with nodeEnv production starts and health responds', async () => {
    const server = await createServer({
      ...minimalConfig,
      nodeEnv: 'production'
    });
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    await server.close();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('status');
  });

  test('createServer with nodeEnv development starts and health responds', async () => {
    const server = await createServer({ ...minimalConfig, nodeEnv: 'development' });
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    await server.close();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('status');
  });
});
