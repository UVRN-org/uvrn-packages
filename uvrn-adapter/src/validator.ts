/**
 * DRVC3 Schema Validator
 * Uses ajv to validate DRVC3 receipts against the official schema
 */

import Ajv from 'ajv';
import * as path from 'path';
import * as fs from 'fs';
import { DRVC3ValidationResult } from './types';

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
 * Validates a DRVC3 receipt against the official schema
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
 * Type guard to check if an object is a valid DRVC3 receipt
 * @param obj - Object to check
 * @returns True if the object is a valid DRVC3 receipt
 */
export function isDRVC3Receipt(obj: unknown): boolean {
  return validateDRVC3(obj).valid;
}
