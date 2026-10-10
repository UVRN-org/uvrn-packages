/**
 * Global Error Handler
 * Handles uncaught errors and formats error responses
 */

import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorResponse } from '../types/api';

/**
 * Register global error handler
 */
export function registerErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Log the error
    request.log.error({
      err: error,
      url: request.url,
      method: request.method
    }, 'Request error');

    // Determine status code
    const statusCode = error.statusCode || 500;

    // Map error to code
    let errorCode = 'INTERNAL_ERROR';
    if (statusCode === 400) errorCode = 'BAD_REQUEST';
    else if (statusCode === 404) errorCode = 'NOT_FOUND';
    else if (statusCode === 415) errorCode = 'UNSUPPORTED_MEDIA_TYPE';
    else if (statusCode === 429) errorCode = 'RATE_LIMIT_EXCEEDED';
    else if (statusCode === 503) errorCode = 'SERVICE_UNAVAILABLE';

    // Build error response
    const errorResponse: ErrorResponse = {
      error: {
        code: errorCode,
        message: error.message || 'An unexpected error occurred',
        details: {
          statusCode
        }
      }
    };

    // Don't expose internal error details in production
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      errorResponse.error.details = {
        ...errorResponse.error.details,
        stack: error.stack
      };
    }

    reply.code(statusCode).send(errorResponse);
  });

  // Handle 404 errors
  server.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        details: {
          method: request.method,
          url: request.url
        }
      }
    };

    reply.code(404).send(errorResponse);
  });
}
