/**
 * MCP Resource Handlers
 * Provides access to schemas and stored data via MCP resources
 */

import { ResourceNotFoundError } from '../types';
import { logger } from '../logger';
import { runEngineSchema, verifyReceiptSchema } from '../tools/schemas';

/**
 * Schema resources
 */

export async function getBundleSchema(): Promise<unknown> {
  logger.debug('getBundleSchema called');
  return runEngineSchema.properties.bundle;
}

export async function getReceiptSchema(): Promise<unknown> {
  logger.debug('getReceiptSchema called');
  return verifyReceiptSchema.properties.receipt;
}

/**
 * Receipt retrieval by UVRN
 * Note: In Phase A.3, we don't have persistent storage yet
 * This is a placeholder for future implementation
 */

export async function getReceiptByUvrn(uvrn: string): Promise<unknown> {
  logger.debug('getReceiptByUvrn called', { uvrn });
  
  // TODO: Implement receipt storage/retrieval in future phase
  throw new ResourceNotFoundError(`Receipt with UVRN ${uvrn} not found (storage not yet implemented)`);
}

/**
 * Bundle retrieval by ID
 * Note: In Phase A.3, we don't have persistent storage yet
 * This is a placeholder for future implementation
 */

export async function getBundleById(id: string): Promise<unknown> {
  logger.debug('getBundleById called', { id });
  
  // TODO: Implement bundle storage/retrieval in future phase
  throw new ResourceNotFoundError(`Bundle with ID ${id} not found (storage not yet implemented)`);
}

/**
 * Resource URI parser
 */

export function parseResourceUri(uri: string): { type: string; id?: string } {
  logger.debug('parseResourceUri', { uri });

  // mcp://delta-engine/schema/bundle
  if (uri === 'mcp://delta-engine/schema/bundle') {
    return { type: 'schema-bundle' };
  }

  // mcp://delta-engine/schema/receipt
  if (uri === 'mcp://delta-engine/schema/receipt') {
    return { type: 'schema-receipt' };
  }

  // mcp://delta-engine/receipts/{uvrn}
  const receiptMatch = uri.match(/^mcp:\/\/delta-engine\/receipts\/(.+)$/);
  if (receiptMatch) {
    return { type: 'receipt', id: receiptMatch[1] };
  }

  // mcp://delta-engine/bundles/{id}
  const bundleMatch = uri.match(/^mcp:\/\/delta-engine\/bundles\/(.+)$/);
  if (bundleMatch) {
    return { type: 'bundle', id: bundleMatch[1] };
  }

  throw new ResourceNotFoundError(`Invalid resource URI: ${uri}`);
}

/**
 * Main resource handler
 */

export async function handleResource(uri: string): Promise<unknown> {
  const parsed = parseResourceUri(uri);

  switch (parsed.type) {
    case 'schema-bundle':
      return getBundleSchema();
    
    case 'schema-receipt':
      return getReceiptSchema();
    
    case 'receipt':
      if (!parsed.id) throw new ResourceNotFoundError('Receipt UVRN missing');
      return getReceiptByUvrn(parsed.id);
    
    case 'bundle':
      if (!parsed.id) throw new ResourceNotFoundError('Bundle ID missing');
      return getBundleById(parsed.id);
    
    default:
      throw new ResourceNotFoundError(`Unknown resource type: ${parsed.type}`);
  }
}
