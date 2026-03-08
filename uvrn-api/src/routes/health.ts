/**
 * Health and Version Routes
 * System status and version information endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HealthResponse, VersionResponse } from '../types/api';

const SERVER_START_TIME = Date.now();
const API_VERSION = '1.0.0';
const PROTOCOL_VERSION = '1.0';

/**
 * Register health and version routes
 */
export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/health - Health check endpoint
  server.get<{
    Reply: HealthResponse;
  }>('/api/v1/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const uptime = Date.now() - SERVER_START_TIME;

    // Check if engine is available by attempting to import it
    let engineAvailable = true;
    try {
      require('@uvrn/core');
    } catch {
      engineAvailable = false;
    }

    const health: HealthResponse = {
      status: engineAvailable ? 'healthy' : 'unhealthy',
      uptime,
      version: API_VERSION,
      engine: {
        available: engineAvailable
      },
      timestamp: new Date().toISOString()
    };

    const statusCode = engineAvailable ? 200 : 503;
    return reply.code(statusCode).send(health);
  });

  // GET /api/v1/version - Version information
  server.get<{
    Reply: VersionResponse;
  }>('/api/v1/version', async (_request: FastifyRequest, reply: FastifyReply) => {
    let engineVersion = 'unknown';
    try {
      const enginePkg = require('@uvrn/core/package.json');
      engineVersion = enginePkg.version;
    } catch {
      // Engine version not available
    }

    const version: VersionResponse = {
      apiVersion: API_VERSION,
      engineVersion,
      protocolVersion: PROTOCOL_VERSION
    };

    return reply.code(200).send(version);
  });
}
