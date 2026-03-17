/**
 * Smoke tests for the API server.
 * Ensures createServer works and health route responds.
 */

import { createServer } from '../src/server';

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
});
