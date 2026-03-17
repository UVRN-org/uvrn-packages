/**
 * DRVC3 Schema Validator and Integrity Verification
 * - validateDRVC3: schema-only (structure); does not verify signatures or embedded receipt hash.
 * - verifyDRVC3Integrity: full integrity check (schema + signature + core receipt hash).
 */

import { verifyReceipt } from '@uvrn/core';
import Ajv from 'ajv';
import * as path from 'path';
import * as fs from 'fs';
import { DRVC3Receipt, DRVC3ValidationResult } from './types';
import { verifySignature } from './signer';
import { extractDeltaReceipt } from './wrapper';

// Load schema from file
const schemaPath = path.join(__dirname, '../schemas/drvc3.schema.json');
const drvc3Schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Initialize Ajv with JSON Schema 2020-12 support
const ajv = new Ajv({ strict: false });

// Add formats support (date-time, etc.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addFormats = require('ajv-formats');
addFormats(ajv);

// Compile the schema once
const validateSchema = ajv.compile(drvc3Schema);

/**
 * Validates a DRVC3 receipt against the official schema only.
 * Does not verify cryptographic signature or embedded receipt hash.
 * For full integrity check, use verifyDRVC3Integrity().
 *
 * @param receipt - The receipt object to validate
 * @returns Validation result with errors if invalid
 */
export function validateDRVC3(receipt: unknown): DRVC3ValidationResult {
  const valid = validateSchema(receipt);
  
  if (valid) {
    return { valid: true };
  }
  
  const errors = validateSchema.errors?.map(err => {
    const path = err.instancePath || '/';
    return `${path}: ${err.message}`;
  }) || ['Unknown validation error'];
  
  return { valid: false, errors };
}

/**
 * Type guard to check if an object is a valid DRVC3 receipt (schema-only).
 * @param obj - Object to check
 * @returns True if the object is a valid DRVC3 receipt
 */
export function isDRVC3Receipt(obj: unknown): boolean {
  return validateDRVC3(obj).valid;
}

/**
 * Full integrity verification: schema, EIP-191 signature, and embedded receipt hash.
 * Use this before trusting envelope contents; extractDeltaReceipt is safe after this passes.
 *
 * @param drvc3 - DRVC3 envelope to verify
 * @returns Object with verified: true, or verified: false and error message
 */
export function verifyDRVC3Integrity(drvc3: unknown): { verified: true } | { verified: false; error: string } {
  const schemaResult = validateDRVC3(drvc3);
  if (!schemaResult.valid) {
    return { verified: false, error: schemaResult.errors?.join('; ') ?? 'Schema validation failed' };
  }

  const envelope = drvc3 as DRVC3Receipt;
  const { integrity, validation } = envelope;
  if (!validation?.checks?.delta_receipt) {
    return { verified: false, error: 'Missing validation.checks.delta_receipt' };
  }

  const receipt = extractDeltaReceipt(envelope);
  const coreResult = verifyReceipt(receipt);
  if (!coreResult.verified) {
    return { verified: false, error: `Embedded receipt: ${coreResult.error}` };
  }

  const sigOk = verifySignature(
    integrity.hash,
    integrity.signature,
    integrity.signer_address
  );
  if (!sigOk) {
    return { verified: false, error: 'Signature verification failed' };
  }

  return { verified: true };
}
