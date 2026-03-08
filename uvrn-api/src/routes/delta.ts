/**
 * Delta Engine API Routes
 * Endpoints for bundle processing, validation, and verification
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  DeltaBundle,
  DeltaReceipt,
  runDeltaEngine,
  validateBundle,
  verifyReceipt
} from '@uvrn/core';
import { ErrorResponse, ValidationResponse } from '../types/api';

/**
 * Register delta engine routes
 */
export async function registerDeltaRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/delta/run - Execute engine on bundle
  server.post<{
    Body: DeltaBundle;
    Reply: DeltaReceipt | ErrorResponse;
  }>('/api/v1/delta/run', async (request: FastifyRequest<{ Body: DeltaBundle }>, reply: FastifyReply) => {
    try {
      const bundle = request.body;

      // Validate bundle schema
      const validation = validateBundle(bundle);
      if (!validation.valid) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_BUNDLE',
            message: 'Bundle validation failed',
            details: { validationError: validation.error }
          }
        });
      }

      // Execute engine
      const receipt = runDeltaEngine(bundle);

      return reply.code(200).send(receipt);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      request.log.error({ error: errorMessage }, 'Engine execution failed');

      return reply.code(500).send({
        error: {
          code: 'ENGINE_ERROR',
          message: 'Failed to process bundle',
          details: { error: errorMessage }
        }
      });
    }
  });

  // POST /api/v1/delta/validate - Validate bundle schema
  server.post<{
    Body: DeltaBundle;
    Reply: ValidationResponse | ErrorResponse;
  }>('/api/v1/delta/validate', async (request: FastifyRequest<{ Body: DeltaBundle }>, reply: FastifyReply) => {
    try {
      const bundle = request.body;
      const validation = validateBundle(bundle);

      if (!validation.valid) {
        return reply.code(200).send({
          valid: false,
          errors: [
            {
              field: 'bundle',
              message: validation.error || 'Validation failed'
            }
          ]
        });
      }

      return reply.code(200).send({ valid: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      request.log.error({ error: errorMessage }, 'Validation failed');

      return reply.code(500).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate bundle',
          details: { error: errorMessage }
        }
      });
    }
  });

  // POST /api/v1/delta/verify - Verify receipt replay
  server.post<{
    Body: DeltaReceipt;
    Reply: { verified: boolean; recomputedHash?: string } | ErrorResponse;
  }>('/api/v1/delta/verify', async (request: FastifyRequest<{ Body: DeltaReceipt }>, reply: FastifyReply) => {
    try {
      const receipt = request.body;
      const verifyResult = verifyReceipt(receipt);

      return reply.code(200).send({
        verified: verifyResult.verified,
        recomputedHash: verifyResult.recomputedHash
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      request.log.error({ error: errorMessage }, 'Verification failed');

      return reply.code(500).send({
        error: {
          code: 'VERIFICATION_ERROR',
          message: 'Failed to verify receipt',
          details: { error: errorMessage }
        }
      });
    }
  });
}
