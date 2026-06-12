/**
 * Delta route, error-handler, and config-loader tests.
 *
 * Uses Fastify inject() (no listening socket) to exercise the
 * /api/v1/delta/* endpoints end-to-end through the real engine,
 * plus the 404/error handler paths and loadConfig() env parsing.
 */
import { FastifyInstance } from 'fastify';
import { runDeltaEngine } from '@uvrn/core';
import { createServer } from '../src/index';
import { loadConfig } from '../src/config/loader';
import type { ServerConfig } from '../src/config/types';

const VALID_BUNDLE = {
  bundleId: 'api-routes-001',
  claim: 'API route test claim',
  thresholdPct: 0.05,
  dataSpecs: [
    {
      id: 'source-a',
      label: 'Source A',
      sourceKind: 'metric',
      originDocIds: ['doc-a'],
      metrics: [{ key: 'value', value: 100 }],
    },
    {
      id: 'source-b',
      label: 'Source B',
      sourceKind: 'metric',
      originDocIds: ['doc-b'],
      metrics: [{ key: 'value', value: 102 }],
    },
  ],
};

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

describe('@uvrn/api delta routes', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer(buildConfig());
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /api/v1/delta/run', () => {
    it('runs the engine and returns a hashed receipt', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/run',
        headers: { 'content-type': 'application/json' },
        payload: VALID_BUNDLE,
      });

      expect(response.statusCode).toBe(200);
      const receipt = response.json();
      expect(receipt.bundleId).toBe('api-routes-001');
      expect(receipt.sources).toEqual(['Source A', 'Source B']);
      expect(receipt.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects an invalid bundle with 400 INVALID_BUNDLE', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/run',
        headers: { 'content-type': 'application/json' },
        payload: { bundleId: 'broken' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_BUNDLE');
      expect(body.error.details.validationError).toBeTruthy();
    });

    it('rejects non-JSON content types with 415', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/run',
        headers: { 'content-type': 'text/plain' },
        payload: 'not json',
      });

      expect(response.statusCode).toBe(415);
      expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('POST /api/v1/delta/validate', () => {
    it('confirms a valid bundle', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { 'content-type': 'application/json' },
        payload: VALID_BUNDLE,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ valid: true });
    });

    it('reports field errors for an invalid bundle (200 with valid:false)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { 'content-type': 'application/json' },
        payload: { bundleId: 'broken' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.valid).toBe(false);
      expect(body.errors[0].message).toBeTruthy();
    });
  });

  describe('POST /api/v1/delta/verify', () => {
    it('verifies an untampered receipt', async () => {
      const receipt = runDeltaEngine(VALID_BUNDLE as Parameters<typeof runDeltaEngine>[0]);
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/verify',
        headers: { 'content-type': 'application/json' },
        payload: receipt,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().verified).toBe(true);
    });

    it('flags a tampered receipt with the recomputed hash', async () => {
      const receipt = runDeltaEngine(VALID_BUNDLE as Parameters<typeof runDeltaEngine>[0]);
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/verify',
        headers: { 'content-type': 'application/json' },
        payload: { ...receipt, outcome: 'tampered' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.verified).toBe(false);
      expect(body.recomputedHash).toBeDefined();
      expect(body.recomputedHash).not.toBe(receipt.hash);
    });
  });

  describe('error handling', () => {
    it('returns a structured 404 for unknown routes', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/v1/unknown' });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('GET /api/v1/unknown');
    });

    it('maps malformed JSON bodies through the global error handler', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/delta/validate',
        headers: { 'content-type': 'application/json' },
        payload: '{ not json }',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.details.statusCode).toBe(400);
    });
  });
});

describe('loadConfig()', () => {
  const ENV_KEYS = [
    'PORT',
    'HOST',
    'CORS_ORIGINS',
    'RATE_LIMIT_MAX',
    'RATE_LIMIT_TIME_WINDOW',
    'LOG_LEVEL',
    'NODE_ENV',
    'UVRN_API_KEY',
    'UVRN_API_KEYS',
  ];
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = {};
    for (const key of ENV_KEYS) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (envBackup[key] === undefined) delete process.env[key];
      else process.env[key] = envBackup[key];
    }
  });

  it('applies documented defaults when env is empty', () => {
    process.env.NODE_ENV = 'test';
    const config = loadConfig();

    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.corsOrigins).toEqual(['*']);
    expect(config.rateLimitMax).toBe(100);
    expect(config.logLevel).toBe('info');
    expect(config.apiKey).toBeUndefined();
    expect(config.apiKeys).toBeUndefined();
  });

  it('parses overrides from the environment', () => {
    process.env.PORT = '8080';
    process.env.HOST = '127.0.0.1';
    process.env.CORS_ORIGINS = 'https://a.example, https://b.example';
    process.env.RATE_LIMIT_MAX = '5';
    process.env.LOG_LEVEL = 'error';
    process.env.NODE_ENV = 'production';
    process.env.UVRN_API_KEYS = 'key-one, key-two,, ';

    const config = loadConfig();

    expect(config.port).toBe(8080);
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.rateLimitMax).toBe(5);
    expect(config.logLevel).toBe('error');
    expect(config.nodeEnv).toBe('production');
    expect(config.apiKeys).toEqual(['key-one', 'key-two']);
  });

  it('throws an aggregated validation error for bad values', () => {
    process.env.PORT = '99999';
    process.env.RATE_LIMIT_MAX = '0';
    process.env.LOG_LEVEL = 'shouting';
    process.env.NODE_ENV = 'staging';

    expect(() => loadConfig()).toThrow(/Configuration validation failed/);
    expect(() => loadConfig()).toThrow(/port: Must be between 1 and 65535/);
    expect(() => loadConfig()).toThrow(/logLevel: Must be one of/);
    expect(() => loadConfig()).toThrow(/nodeEnv: Must be one of/);
  });
});
