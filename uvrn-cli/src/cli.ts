#!/usr/bin/env node

/**
 * Loosechain Delta Engine CLI
 * Command-line interface for running delta engine operations
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { runDeltaEngine, validateBundle, verifyReceipt } from '@uvrn/core';
import type { DeltaBundle, DeltaReceipt } from '@uvrn/core';

const packageJson = require('../package.json');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_INVALID_BUNDLE = 1;
const EXIT_ENGINE_ERROR = 2;
const EXIT_IO_ERROR = 3;

interface CliOptions {
  output?: string;
  quiet?: boolean;
  pretty?: boolean;
}

/**
 * Read input from file, stdin, or URL
 */
async function readInput(input?: string): Promise<string> {
  try {
    // If no input specified, read from stdin
    if (!input || input === '-') {
      return await readStdin();
    }

    // Check if it's a URL
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return await fetchUrl(input);
    }

    // Otherwise, treat as file path
    const resolvedPath = path.resolve(process.cwd(), input);
    return fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read input: ${(error as Error).message}`);
  }
}

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Fetch from URL
 */
async function fetchUrl(url: string): Promise<string> {
  const https = url.startsWith('https://') ? require('https') : require('http');

  return new Promise((resolve, reject) => {
    https.get(url, (res: any) => {
      let data = '';

      res.on('data', (chunk: string) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', (error: Error) => {
      reject(error);
    });
  });
}

/**
 * Parse JSON safely
 */
function parseJson<T>(jsonString: string, type: string): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON for ${type}: ${(error as Error).message}`);
  }
}

/**
 * Write output to file or stdout
 */
function writeOutput(data: any, options: CliOptions): void {
  const output = options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);

  if (options.output) {
    try {
      const resolvedPath = path.resolve(process.cwd(), options.output);
      fs.writeFileSync(resolvedPath, output, 'utf-8');
      if (!options.quiet) {
        console.error(`Output written to: ${options.output}`);
      }
    } catch (error) {
      console.error(`Failed to write output file: ${(error as Error).message}`);
      process.exit(EXIT_IO_ERROR);
    }
  } else {
    console.log(output);
  }
}

/**
 * Command: run
 * Execute the delta engine on a bundle
 */
async function runCommand(input: string | undefined, options: CliOptions): Promise<void> {
  try {
    // Read and parse bundle
    const bundleJson = await readInput(input);
    const bundle = parseJson<DeltaBundle>(bundleJson, 'bundle');

    // Run engine
    const receipt = runDeltaEngine(bundle);

    // Output receipt
    writeOutput(receipt, options);
    process.exit(EXIT_SUCCESS);
  } catch (error) {
    const errorMessage = (error as Error).message;

    if (!options.quiet) {
      console.error('Error:', errorMessage);
    }

    if (errorMessage.includes('Invalid DeltaBundle')) {
      process.exit(EXIT_INVALID_BUNDLE);
    } else if (errorMessage.includes('Failed to read input')) {
      process.exit(EXIT_IO_ERROR);
    } else {
      process.exit(EXIT_ENGINE_ERROR);
    }
  }
}

/**
 * Command: validate
 * Validate bundle structure without running engine
 */
async function validateCommand(input: string | undefined, options: CliOptions): Promise<void> {
  try {
    // Read and parse bundle
    const bundleJson = await readInput(input);
    const bundle = parseJson<DeltaBundle>(bundleJson, 'bundle');

    // Validate
    const result = validateBundle(bundle);

    if (result.valid) {
      if (!options.quiet) {
        console.log('✓ Bundle is valid');
      }
      writeOutput({ valid: true }, options);
      process.exit(EXIT_SUCCESS);
    } else {
      if (!options.quiet) {
        console.error('✗ Bundle is invalid:', result.error);
      }
      writeOutput({ valid: false, error: result.error }, options);
      process.exit(EXIT_INVALID_BUNDLE);
    }
  } catch (error) {
    if (!options.quiet) {
      console.error('Error:', (error as Error).message);
    }
    process.exit(EXIT_IO_ERROR);
  }
}

/**
 * Command: verify
 * Verify receipt integrity by replaying hash computation
 */
async function verifyCommand(input: string | undefined, options: CliOptions): Promise<void> {
  try {
    // Read and parse receipt
    const receiptJson = await readInput(input);
    const receipt = parseJson<DeltaReceipt>(receiptJson, 'receipt');

    // Verify
    const result = verifyReceipt(receipt);

    if (result.verified) {
      if (!options.quiet) {
        console.log('✓ Receipt is valid');
        console.log('  Hash:', receipt.hash);
      }
      writeOutput({ verified: true, hash: receipt.hash }, options);
      process.exit(EXIT_SUCCESS);
    } else {
      if (!options.quiet) {
        console.error('✗ Receipt verification failed:', result.error);
        if (result.recomputedHash) {
          console.error('  Expected:', receipt.hash);
          console.error('  Computed:', result.recomputedHash);
        }
      }
      writeOutput({
        verified: false,
        error: result.error,
        providedHash: receipt.hash,
        recomputedHash: result.recomputedHash
      }, options);
      process.exit(EXIT_ENGINE_ERROR);
    }
  } catch (error) {
    if (!options.quiet) {
      console.error('Error:', (error as Error).message);
    }
    process.exit(EXIT_IO_ERROR);
  }
}

/**
 * Main CLI setup
 */
function main(): void {
  const program = new Command();

  program
    .name('delta-engine')
    .description('CLI for Loosechain Delta Engine - Bundle → Receipt')
    .version(packageJson.version);

  program
    .command('run [bundle]')
    .description('Execute delta engine on a bundle (file path, URL, or stdin)')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-q, --quiet', 'Suppress informational messages')
    .option('-p, --pretty', 'Pretty-print JSON output')
    .action(runCommand);

  program
    .command('validate [bundle]')
    .description('Validate bundle structure without running engine')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-q, --quiet', 'Suppress informational messages')
    .option('-p, --pretty', 'Pretty-print JSON output')
    .action(validateCommand);

  program
    .command('verify [receipt]')
    .description('Verify receipt integrity by replaying hash computation')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-q, --quiet', 'Suppress informational messages')
    .option('-p, --pretty', 'Pretty-print JSON output')
    .action(verifyCommand);

  program.parse(process.argv);

  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// Run CLI
if (require.main === module) {
  main();
}

export { main };
