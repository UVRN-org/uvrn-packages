/**
 * Custom Error Classes for Delta Engine SDK
 */

/**
 * Base error class for all Delta Engine SDK errors
 */
export class DeltaEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeltaEngineError';
    Object.setPrototypeOf(this, DeltaEngineError.prototype);
  }
}

/**
 * Error thrown when bundle or receipt validation fails
 */
export class ValidationError extends DeltaEngineError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(message: string, errors: Array<{ field: string; message: string }> = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown during engine execution
 */
export class ExecutionError extends DeltaEngineError {
  public readonly exitCode?: number;
  public readonly stderr?: string;

  constructor(message: string, exitCode?: number, stderr?: string) {
    super(message);
    this.name = 'ExecutionError';
    this.exitCode = exitCode;
    this.stderr = stderr;
    Object.setPrototypeOf(this, ExecutionError.prototype);
  }
}

/**
 * Error thrown during HTTP API communication (HTTP mode only)
 */
export class NetworkError extends DeltaEngineError {
  public readonly statusCode?: number;
  public readonly response?: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends DeltaEngineError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}
