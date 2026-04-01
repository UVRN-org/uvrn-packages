/**
 * MCP Server Type Definitions
 * Extends uvrn-core types with MCP-specific interfaces
 */

// Import core types for use in this file
import type {
  DeltaBundle,
  DeltaReceipt,
  DeltaRound,
  DataSpec,
  MetricPoint,
  ValidationResult,
  VerifyResult,
  Outcome,
  EngineOpts,
} from '@uvrn/core';

// Re-export core types for consumers of this module
export type {
  DeltaBundle,
  DeltaReceipt,
  DeltaRound,
  DataSpec,
  MetricPoint,
  ValidationResult,
  VerifyResult,
  Outcome,
  EngineOpts,
};

/**
 * MCP Tool Input/Output Types
 */

export interface RunEngineInput {
  bundle: DeltaBundle;
  options?: {
    timestamp?: string;
  };
}

export interface RunEngineOutput {
  receipt: DeltaReceipt;
  success: true;
}

export interface ValidateBundleInput {
  bundle: DeltaBundle;
}

export interface ValidateBundleOutput {
  valid: boolean;
  error?: string;
  details?: string;
}

export interface VerifyReceiptInput {
  receipt: DeltaReceipt;
}

export interface VerifyReceiptOutput {
  verified: boolean;
  recomputedHash?: string;
  error?: string;
  details?: string;
}

/**
 * MCP Resource Types
 */

export interface ResourceUriParams {
  uvrn?: string;
  id?: string;
}

/**
 * MCP Error Types
 */

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ExecutionError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXECUTION_ERROR', details);
    this.name = 'ExecutionError';
  }
}

export class ResourceNotFoundError extends MCPError {
  constructor(resourceId: string) {
    super(`Resource not found: ${resourceId}`, 'RESOURCE_NOT_FOUND', { resourceId });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Configuration Types
 */

export interface ServerConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  storagePath?: string;
  maxBundleSize?: number;
  verboseErrors?: boolean;
}
