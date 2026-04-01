/**
 * MCP Tool Handlers
 * Implements the three core tools for Delta Engine MCP server
 */

import {
  runDeltaEngine,
  validateBundle,
  verifyReceipt,
  DeltaBundle,
  DeltaReceipt,
} from '@uvrn/core';
import {
  RunEngineInput,
  RunEngineOutput,
  ValidateBundleInput,
  ValidateBundleOutput,
  VerifyReceiptInput,
  VerifyReceiptOutput,
  ValidationError,
  ExecutionError,
} from '../types';
import { logger } from '../logger';
import { config } from '../config';

/**
 * Tool: delta_run_engine
 * Executes the Delta Engine on a provided bundle
 */
export async function handleRunEngine(input: RunEngineInput): Promise<RunEngineOutput> {
  logger.debug('handleRunEngine called', { bundleId: input.bundle?.bundleId });

  try {
    // Validate input structure
    if (!input.bundle || typeof input.bundle !== 'object') {
      throw new ValidationError('Invalid input: bundle must be an object');
    }

    const bundle = input.bundle as DeltaBundle;

    // Enforce MAX_BUNDLE_SIZE if configured
    if (config.maxBundleSize) {
      const bundleSize = JSON.stringify(bundle).length;
      if (bundleSize > config.maxBundleSize) {
        throw new ValidationError(
          `Bundle size (${bundleSize} bytes) exceeds maximum allowed size (${config.maxBundleSize} bytes)`,
          { bundleSize, maxBundleSize: config.maxBundleSize }
        );
      }
    }

    // Explicitly validate bundle structure before execution
    const validationResult = validateBundle(bundle);
    if (!validationResult.valid) {
      throw new ValidationError(
        `Bundle validation failed: ${validationResult.error}`,
        { validationResult }
      );
    }

    // Run the engine
    const receipt = runDeltaEngine(bundle, {
      timestamp: input.options?.timestamp,
    });

    logger.info('Engine executed successfully', {
      bundleId: bundle.bundleId,
      outcome: receipt.outcome,
    });

    return {
      receipt,
      success: true,
    };
  } catch (error) {
    // Preserve validation errors as-is
    if (error instanceof ValidationError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : String(error);
    const errorDetails = config.verboseErrors ? { originalError: error } : undefined;
    
    logger.error('Engine execution failed', { error: message });
    throw new ExecutionError(`Engine execution failed: ${message}`, errorDetails);
  }
}

/**
 * Tool: delta_validate_bundle
 * Validates bundle structure without executing
 */
export async function handleValidateBundle(
  input: ValidateBundleInput
): Promise<ValidateBundleOutput> {
  logger.debug('handleValidateBundle called');

  try {
    // Validate input structure
    if (!input.bundle || typeof input.bundle !== 'object') {
      return {
        valid: false,
        error: 'Invalid input: bundle must be an object',
        details: 'The provided bundle is not a valid object',
      };
    }

    const bundle = input.bundle as DeltaBundle;
    const result = validateBundle(bundle);

    logger.info('Bundle validation completed', {
      valid: result.valid,
      bundleId: bundle.bundleId,
    });

    return {
      valid: result.valid,
      error: result.error,
      details: result.valid
        ? `Bundle "${bundle.bundleId}" is valid with ${bundle.dataSpecs.length} data specs`
        : result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Bundle validation error', { error: message });
    
    return {
      valid: false,
      error: 'Validation error',
      details: message,
    };
  }
}

/**
 * Tool: delta_verify_receipt
 * Verifies receipt integrity and hash chain
 */
export async function handleVerifyReceipt(
  input: VerifyReceiptInput
): Promise<VerifyReceiptOutput> {
  logger.debug('handleVerifyReceipt called');

  try {
    // Validate input structure
    if (!input.receipt || typeof input.receipt !== 'object') {
      return {
        verified: false,
        error: 'Invalid input: receipt must be an object',
        details: 'The provided receipt is not a valid object',
      };
    }

    const receipt = input.receipt as DeltaReceipt;
    const result = verifyReceipt(receipt);

    logger.info('Receipt verification completed', {
      verified: result.verified,
      bundleId: receipt.bundleId,
    });

    return {
      verified: result.verified,
      recomputedHash: result.recomputedHash,
      error: result.error,
      details: result.verified
        ? `Receipt for bundle "${receipt.bundleId}" is valid. Hash verified: ${receipt.hash}`
        : result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Receipt verification error', { error: message });
    
    return {
      verified: false,
      error: 'Verification error',
      details: message,
    };
  }
}
