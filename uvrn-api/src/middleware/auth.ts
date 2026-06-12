/**
 * Optional API-Key Authentication
 *
 * Protects the delta routes (`/api/v1/delta/*`) when one or more API keys
 * are configured. Uses the same client convention as the UVRN worker:
 *
 *   Authorization: Bearer <key>
 *   X-UVRN-API-Key: <key>
 *
 * Health and version routes stay open. When no key is configured, this
 * middleware registers nothing and the API behaves exactly as before (open).
 */

import { timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { ServerConfig } from '../config/types';
import { ErrorResponse } from '../types/api';

/** URL prefix of routes that require a key when auth is configured. */
const PROTECTED_PREFIX = '/api/v1/delta/';

/**
 * Extract the presented API key from `Authorization: Bearer <key>` or
 * `X-UVRN-API-Key: <key>`. Returns null when neither header carries a key.
 */
export function extractApiKey(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  const headerKey = request.headers['x-uvrn-api-key'];
  if (typeof headerKey === 'string' && headerKey.length > 0) {
    return headerKey;
  }

  return null;
}

/**
 * Constant-time string comparison. Lengths are checked first (length is not
 * secret), then equal-length buffers are compared with crypto.timingSafeEqual.
 */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Resolve the effective key set from config (`apiKey` merged with `apiKeys`,
 * blanks dropped). An empty result means auth is disabled.
 */
export function resolveApiKeys(config: ServerConfig): string[] {
  return [
    ...(config.apiKey ? [config.apiKey] : []),
    ...(config.apiKeys ?? [])
  ].filter(key => key.length > 0);
}

/**
 * Register the auth hook when keys are configured. No-op (open API) otherwise.
 */
export function registerAuth(server: FastifyInstance, config: ServerConfig): void {
  const keys = resolveApiKeys(config);
  if (keys.length === 0) {
    return;
  }

  server.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith(PROTECTED_PREFIX)) {
      return;
    }

    const presented = extractApiKey(request);
    if (presented !== null && keys.some(key => safeEqual(presented, key))) {
      return;
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Include Authorization: Bearer <key> or X-UVRN-API-Key: <key>.'
      }
    };

    return reply.code(401).send(errorResponse);
  });
}
