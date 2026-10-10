/**
 * API-key auth tests
 *
 * Uses Fastify's built-in inject() so no listening socket is required.
 * Covers open mode (no key configured), Bearer / X-UVRN-API-Key acceptance,
 * rejection of missing and wrong keys, and the always-open health route.
 */
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index';
import type { ServerConfig } from '../src/config/types';

const TEST_KEY = 'test-key-1234567890';

function buildConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    nodeEnv: 'test',
    logLevel: 'fatal',
    corsOrigins: ['*'],
    rateLimitMax: 1000,
    rateLimitTimeWindow: '1 minute',
    ...overrides,
  };
}

describe('@uvrn/api auth', () => {
  let server: FastifyInstance | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe('no key configured (open mode — default behavior)', () => {
    beforeEach(async () => {
      server = await createServer(buildConfig());
    });

    it('GET /api/v1/health responds 200 without any credentials', async () => {
      const response = await server!.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('healthy');
    });

    it('POST /api/v1/delta/validate is open without a key', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('valid');
    });
  });

  describe('apiKey configured', () => {
    beforeEach(async () => {
      server = await createServer(buildConfig({ apiKey: TEST_KEY }));
    });

    it('GET /api/v1/health stays open without a key', async () => {
      const response = await server!.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);
    });

    it('GET /api/v1/version stays open without a key', async () => {
      const response = await server!.inject({ method: 'GET', url: '/api/v1/version' });
      expect(response.statusCode).toBe(200);
    });

    it('POST /api/v1/delta/validate returns 401 without a key', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        payload: {},
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/v1/delta/run returns 401 without a key', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/run',
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });

    it('accepts a valid key via Authorization: Bearer', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { authorization: `Bearer ${TEST_KEY}` },
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('valid');
    });

    it('accepts a valid key via X-UVRN-API-Key', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { 'x-uvrn-api-key': TEST_KEY },
        payload: {},
      });
      expect(response.statusCode).toBe(200);
    });

    it('rejects a wrong key of the same length with 401', async () => {
      const wrongKey = 'x'.repeat(TEST_KEY.length);
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { authorization: `Bearer ${wrongKey}` },
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a wrong key of a different length with 401', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { 'x-uvrn-api-key': 'short' },
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a malformed Authorization header (no Bearer prefix) with 401', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { authorization: TEST_KEY },
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('apiKeys list configured (rotation)', () => {
    beforeEach(async () => {
      server = await createServer(buildConfig({ apiKeys: ['key-alpha-000111', 'key-beta-222333'] }));
    });

    it('accepts any key in the list', async () => {
      for (const key of ['key-alpha-000111', 'key-beta-222333']) {
        const response = await server!.inject({
          method: 'POST',
          url: '/api/v1/delta/validate',
          headers: { authorization: `Bearer ${key}` },
          payload: {},
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('rejects keys not in the list', async () => {
      const response = await server!.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { authorization: 'Bearer key-gamma-444555' },
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
