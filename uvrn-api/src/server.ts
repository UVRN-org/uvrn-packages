/**
 * Delta Engine API Server
 * Fastify-based REST API for bundle processing
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './config/loader';
import { ServerConfig } from './config/types';
import { registerDeltaRoutes } from './routes/delta';
import { registerHealthRoutes } from './routes/health';
import { registerErrorHandler } from './middleware/errorHandler';

/**
 * Create and configure Fastify server instance
 */
export async function createServer(config?: ServerConfig): Promise<FastifyInstance> {
  // Load configuration
  const serverConfig = config || loadConfig();

  // Create Fastify instance with logging
  const server = Fastify({
    logger: {
      level: serverConfig.logLevel,
      transport: serverConfig.nodeEnv === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    }
  });

  // Register plugins
  await server.register(helmet, {
    contentSecurityPolicy: serverConfig.nodeEnv === 'production' ? undefined : false
  });

  await server.register(cors, {
    origin: serverConfig.corsOrigins,
    credentials: true
  });

  await server.register(rateLimit, {
    max: serverConfig.rateLimitMax,
    timeWindow: serverConfig.rateLimitTimeWindow,
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: {
          rateLimitMax: serverConfig.rateLimitMax,
          timeWindow: serverConfig.rateLimitTimeWindow
        }
      }
    })
  });

  // Add request logging hook
  server.addHook('onRequest', async (request, _reply) => {
    request.log.info({
      url: request.url,
      method: request.method,
      ip: request.ip
    }, 'Incoming request');
  });

  server.addHook('onResponse', async (request, reply) => {
    request.log.info({
      url: request.url,
      method: request.method,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime
    }, 'Request completed');
  });

  // Validate content-type for POST requests
  server.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST' && request.url.startsWith('/api/v1/delta/')) {
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        return reply.code(415).send({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json',
            details: {
              receivedContentType: contentType || 'none'
            }
          }
        });
      }
    }
  });

  // Register routes
  await registerHealthRoutes(server);
  await registerDeltaRoutes(server);

  // Register error handler (must be last)
  registerErrorHandler(server);

  return server;
}

/**
 * Start the server
 */
export async function startServer(config?: ServerConfig): Promise<FastifyInstance> {
  const serverConfig = config || loadConfig();
  const server = await createServer(serverConfig);

  try {
    await server.listen({
      port: serverConfig.port,
      host: serverConfig.host
    });

    server.log.info(`🚀 Delta Engine API server running at http://${serverConfig.host}:${serverConfig.port}`);
    server.log.info(`📊 Health check: http://${serverConfig.host}:${serverConfig.port}/api/v1/health`);
    server.log.info(`📦 Environment: ${serverConfig.nodeEnv}`);
    server.log.info(`🔒 Rate limit: ${serverConfig.rateLimitMax} requests per ${serverConfig.rateLimitTimeWindow}`);

    return server;
  } catch (error) {
    server.log.error(error);
    throw error;
  }
}

// Start server if run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
