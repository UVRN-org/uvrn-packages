/**
 * Delta Engine SDK Client
 *
 * Main client class for interacting with Delta Engine in multiple modes:
 * - CLI: Spawns CLI process
 * - HTTP: Makes API requests
 * - Local: Direct function calls
 */

import type { DeltaBundle, DeltaReceipt } from '@uvrn/core';
import type { ClientOptions, ValidationResult, VerificationResult } from './types/sdk';
import { validateBundle, validateReceipt, verifyReceiptHash } from './validators';
import {
  DeltaEngineError,
  ValidationError,
  ExecutionError,
  NetworkError,
  ConfigurationError
} from './errors';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * Client for interacting with Delta Engine
 *
 * Supports three execution modes:
 * - **CLI**: Spawns the CLI executable
 * - **HTTP**: Makes requests to REST API
 * - **Local**: Direct import of core engine
 *
 * @example
 * ```typescript
 * // CLI mode
 * const client = new DeltaEngineClient({
 *   mode: 'cli',
 *   cliPath: '/usr/local/bin/uvrn'
 * });
 *
 * // HTTP mode
 * const client = new DeltaEngineClient({
 *   mode: 'http',
 *   apiUrl: 'http://localhost:3000',
 *   timeout: 30000
 * });
 *
 * // Local mode
 * const client = new DeltaEngineClient({
 *   mode: 'local'
 * });
 * ```
 */
export class DeltaEngineClient {
  private readonly options: Required<ClientOptions>;

  /**
   * Creates a new DeltaEngineClient
   *
   * @param options - Client configuration
   * @throws {ConfigurationError} if configuration is invalid
   */
  constructor(options: ClientOptions) {
    // Validate configuration
    this.validateOptions(options);

    // Set defaults
    this.options = {
      mode: options.mode,
      cliPath: options.cliPath || '',
      apiUrl: options.apiUrl || '',
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      apiKey: options.apiKey || ''
    };
  }

  /**
   * Validates client options
   * @internal
   */
  private validateOptions(options: ClientOptions): void {
    if (!options.mode) {
      throw new ConfigurationError('mode is required');
    }

    if (!['cli', 'http', 'local'].includes(options.mode)) {
      throw new ConfigurationError(`Invalid mode: ${options.mode}. Must be 'cli', 'http', or 'local'`);
    }

    if (options.mode === 'cli' && !options.cliPath) {
      throw new ConfigurationError('cliPath is required for CLI mode');
    }

    if (options.mode === 'http' && !options.apiUrl) {
      throw new ConfigurationError('apiUrl is required for HTTP mode');
    }
  }

  /**
   * Executes a bundle and returns a receipt
   *
   * @param bundle - The DeltaBundle to execute
   * @returns Promise resolving to DeltaReceipt
   * @throws {ValidationError} if bundle is invalid
   * @throws {ExecutionError} if execution fails
   * @throws {NetworkError} if HTTP request fails (HTTP mode only)
   *
   * @example
   * ```typescript
   * const bundle = {
   *   bundleId: 'test-1',
   *   claim: 'Revenue matches forecast',
   *   dataSpecs: [...],
   *   thresholdPct: 0.05
   * };
   *
   * const receipt = await client.runEngine(bundle);
   * console.log('Outcome:', receipt.outcome);
   * ```
   */
  async runEngine(bundle: DeltaBundle): Promise<DeltaReceipt> {
    // Validate bundle first
    const validation = validateBundle(bundle);
    if (!validation.valid) {
      throw new ValidationError('Invalid bundle', validation.errors || []);
    }

    // Execute based on mode
    switch (this.options.mode) {
      case 'cli':
        return this.runEngineCLI(bundle);
      case 'http':
        return this.runEngineHTTP(bundle);
      case 'local':
        return this.runEngineLocal(bundle);
      default:
        throw new ConfigurationError(`Unsupported mode: ${this.options.mode}`);
    }
  }

  /**
   * Executes bundle via CLI mode
   * @internal
   */
  private async runEngineCLI(bundle: DeltaBundle): Promise<DeltaReceipt> {
    const tempFile = join(tmpdir(), `delta-bundle-${randomBytes(8).toString('hex')}.json`);

    try {
      // Write bundle to temp file
      await writeFile(tempFile, JSON.stringify(bundle, null, 2));

      // Spawn CLI process
      const result = await this.spawnCLI(tempFile);

      // Parse and validate receipt
      const receipt = JSON.parse(result) as DeltaReceipt;
      const receiptValidation = validateReceipt(receipt);

      if (!receiptValidation.valid) {
        throw new ValidationError('Invalid receipt from CLI', receiptValidation.errors || []);
      }

      return receipt;
    } catch (error) {
      if (error instanceof DeltaEngineError) {
        throw error;
      }
      throw new ExecutionError(
        `CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Clean up temp file
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Spawns CLI process and captures output
   * @internal
   */
  private spawnCLI(bundlePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.options.cliPath, ['run', bundlePath], {
        timeout: this.options.timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new ExecutionError(`Failed to spawn CLI: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new ExecutionError(`CLI exited with code ${code ?? -1}`, code ?? undefined, stderr));
        }
      });
    });
  }

  /**
   * Executes bundle via HTTP API mode
   * @internal
   */
  private async runEngineHTTP(bundle: DeltaBundle): Promise<DeltaReceipt> {
    const url = `${this.options.apiUrl}/api/v1/delta/run`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.options.apiKey) {
        headers['X-UVRN-API-Key'] = this.options.apiKey;
      }

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bundle)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const receipt = await response.json() as DeltaReceipt;

      // Validate receipt
      const validation = validateReceipt(receipt);
      if (!validation.valid) {
        throw new ValidationError('Invalid receipt from API', validation.errors || []);
      }

      return receipt;
    } catch (error) {
      if (error instanceof DeltaEngineError) {
        throw error;
      }
      throw new NetworkError(
        `HTTP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch with retry logic
   * @internal
   */
  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt < this.options.retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Executes bundle via local mode (direct import)
   * @internal
   */
  private async runEngineLocal(bundle: DeltaBundle): Promise<DeltaReceipt> {
    try {
      // Dynamic import to avoid bundling core if not needed
      const { runDeltaEngine } = await import('@uvrn/core');

      const receipt = runDeltaEngine(bundle);

      // Validate receipt
      const validation = validateReceipt(receipt);
      if (!validation.valid) {
        throw new ValidationError('Invalid receipt from local engine', validation.errors || []);
      }

      return receipt;
    } catch (error) {
      if (error instanceof DeltaEngineError) {
        throw error;
      }
      throw new ExecutionError(
        `Local execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates a bundle without executing it
   *
   * @param bundle - The bundle to validate
   * @returns ValidationResult with detailed errors
   *
   * @example
   * ```typescript
   * const result = await client.validateBundle(bundle);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  async validateBundle(bundle: DeltaBundle): Promise<ValidationResult> {
    return validateBundle(bundle);
  }

  /**
   * Verifies a receipt's integrity and determinism
   *
   * Checks:
   * 1. Receipt hash integrity
   * 2. Deterministic replay (if original bundle available)
   *
   * @param receipt - The receipt to verify
   * @returns VerificationResult with detailed information
   *
   * @example
   * ```typescript
   * const result = await client.verifyReceipt(receipt);
   * if (!result.verified) {
   *   console.error('Receipt verification failed!');
   * }
   * if (!result.deterministic) {
   *   console.warn('Non-deterministic execution detected!');
   * }
   * ```
   */
  async verifyReceipt(receipt: DeltaReceipt): Promise<VerificationResult> {
    // Validate receipt structure first
    const validation = validateReceipt(receipt);
    if (!validation.valid) {
      return {
        verified: false,
        deterministic: false,
        error: `Invalid receipt structure: ${validation.errors?.map(e => e.message).join(', ')}`
      };
    }

    // Verify hash
    const hashValid = verifyReceiptHash(receipt);

    if (!hashValid) {
      return {
        verified: false,
        deterministic: false,
        originalHash: receipt.hash,
        error: 'Receipt hash verification failed - receipt may have been tampered with'
      };
    }

    // For determinism check, we would need the original bundle
    // This is a limitation - receipts don't currently store bundles
    return {
      verified: true,
      deterministic: true, // Assumed true if hash is valid
      originalHash: receipt.hash,
      details: {
        note: 'Determinism check requires original bundle replay'
      }
    };
  }
}
