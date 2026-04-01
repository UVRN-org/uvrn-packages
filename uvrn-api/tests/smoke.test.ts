/**
 * Smoke test: API package exports and server creation
 */
import { createServer, startServer } from '../src/index';
import type { ServerConfig } from '../src/config/types';

describe('@uvrn/api smoke', () => {
  it('exports createServer and startServer', () => {
    expect(typeof createServer).toBe('function');
    expect(typeof startServer).toBe('function');
  });

  it('createServer returns a Fastify instance', async () => {
    const config: ServerConfig = {
      port: 0,
      host: '127.0.0.1',
      nodeEnv: 'test',
      logLevel: 'fatal',
      corsOrigins: ['*'],
      rateLimitMax: 100,
      rateLimitTimeWindow: '1m',
    };
    const server = await createServer(config);
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
    await server.close();
  });
});
