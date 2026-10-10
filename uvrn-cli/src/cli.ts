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

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_MAX_BODY = 5 * 1024 * 1024; // 5 MiB

/**
 * Fetch from URL with timeout and max body size
 */
async function fetchUrl(url: string): Promise<string> {
  const https = url.startsWith('https://') ? require('https') : require('http');

  return new Promise((resolve, reject) => {
    const req = https.get(url, (res: any) => {
      let data = '';

      res.on('data', (chunk: string | Buffer) => {
        data += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        if (data.length > FETCH_MAX_BODY) {
          clearTimeout(timer);
          req.destroy(new Error(`Response body exceeds ${FETCH_MAX_BODY} bytes`));
        }
      });

      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    const timer = setTimeout(() => {
      req.destroy(new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);

    req.on('error', (error: Error) => {
      clearTimeout(timer);
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
 * Command: verify-receipt
 * Full verification of a NetworkReceipt (uvrn-receipt-4): hash recompute + Ed25519 signature.
 * Honest vocabulary: integrity alone is reported as integrity-checked, never verified.
 */
async function verifyNetworkReceiptCommand(
  input: string | undefined,
  options: CliOptions & { key?: string; human?: boolean }
): Promise<void> {
  try {
    const receiptJson = await readInput(input);
    const receipt = parseJson<import('@uvrn/receipt').NetworkReceipt>(receiptJson, 'receipt');
    const { verifyReceiptFull, toHumanView } = require('@uvrn/receipt') as typeof import('@uvrn/receipt');

    const result = verifyReceiptFull(receipt, options.key ? { publicKey: options.key } : {});
    // With --key the caller asked for signature verification: anything short of a valid
    // signature (wrong key, forged signature, unsigned receipt) must fail the exit code.
    const signatureRequested = Boolean(options.key);
    const signatureFailed = signatureRequested && result.integrityOk && !result.verified;
    // An unsigned receipt's library error already reads "integrity-checked only — …".
    const detail = result.signed ? result.error : 'receipt is unsigned, no signature to verify';

    if (!options.quiet) {
      if (result.verified) {
        console.log('✓ Receipt VERIFIED (integrity + signature)');
      } else if (signatureFailed) {
        console.error(
          `✗ Receipt NOT verified — signature check failed (--key given): ${detail ?? 'signature not verified'}; integrity checks out`
        );
      } else if (result.integrityOk) {
        console.log(`○ Receipt integrity-checked only — ${detail ?? 'signature not verified'}`);
      } else {
        console.error('✗ Receipt verification failed:', result.error);
      }
      console.log('  Hash:', receipt.receiptHash);
      if (options.human) {
        const view = toHumanView(receipt);
        console.log('  Verdict:', view.verdictLabel);
        console.log('  Claim:', view.claim);
        console.log('  ', view.headline);
      }
    }
    writeOutput(
      {
        verified: result.verified,
        integrityOk: result.integrityOk,
        signed: result.signed,
        signatureOk: result.signatureOk,
        error: result.error,
        hash: receipt.receiptHash,
      },
      options
    );
    process.exit(result.integrityOk && !signatureFailed ? EXIT_SUCCESS : EXIT_ENGINE_ERROR);
  } catch (error) {
    if (!options.quiet) {
      console.error('Error:', (error as Error).message);
    }
    process.exit(EXIT_IO_ERROR);
  }
}

const DEFAULT_PROB_KEY_ENV = 'UVRN_PROB_PRIVATE_KEY';
const LIBRARY_ONLY_PROB_INPUTS = new Set(['uvrn-probability-input-2', 'uvrn-probability-input-3']);

type ProbOptions = CliOptions & { keyRef?: string; keyEnv?: string; signedAt?: string };

function loadProbability(): typeof import('@uvrn/probability') {
  try {
    return require('@uvrn/probability') as typeof import('@uvrn/probability');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      throw new Error('`uvrn prob` requires the optional peer @uvrn/probability — install it first');
    }
    throw error;
  }
}

/**
 * Command: prob run
 * Deterministic probability from cited market / base-rate inputs (uvrn-probability-1).
 * A refusal (method insufficient_basis) is a valid result and exits 0; malformed input exits 1.
 * The signing key is read from an environment variable, never from argv.
 */
async function probRunCommand(input: string | undefined, options: ProbOptions): Promise<void> {
  let probability: typeof import('@uvrn/probability');
  let runInput: import('@uvrn/probability').ProbabilityRunInput;
  let signer: import('@uvrn/probability').ProbabilitySigner | undefined;
  try {
    probability = loadProbability();
    runInput = parseJson<import('@uvrn/probability').ProbabilityRunInput>(await readInput(input), 'inputs');
    if (options.keyRef) {
      const envName = options.keyEnv ?? DEFAULT_PROB_KEY_ENV;
      const privateKey = process.env[envName];
      if (!privateKey) {
        throw new Error(`--key-ref given but ${envName} is not set (base64 Ed25519 seed)`);
      }
      signer = {
        privateKey,
        publicKeyRef: options.keyRef,
        ...(options.signedAt !== undefined ? { signedAt: options.signedAt } : {}),
      };
    }
  } catch (error) {
    if (!options.quiet) {
      console.error('Error:', (error as Error).message);
    }
    process.exit(EXIT_IO_ERROR);
    return;
  }

  if (LIBRARY_ONLY_PROB_INPUTS.has((runInput as { specVersion?: unknown }).specVersion as string)) {
    if (!options.quiet) {
      console.error(
        'Error: uvrn prob run accepts uvrn-probability-input-1 only; input-2/input-3 are library-only (runForecast).'
      );
    }
    process.exit(EXIT_INVALID_BUNDLE);
    return;
  }

  try {
    const result = probability.runProbability(runInput, { signer });
    if (!options.quiet) {
      if (result.method === 'insufficient_basis') {
        const codes = [...new Set(result.refusals.map((r) => r.code))].join(', ');
        console.error(`○ insufficient_basis — ${codes}`);
      } else {
        console.error(`✓ ${result.method} p=${result.p} band=[${result.low}, ${result.high}]`);
      }
      console.error('  Probability hash:', result.probabilityHash);
      console.error(`  Receipt: ${result.receipt.receiptHash}${result.receipt.signature ? ' (signed)' : ' (unsigned)'}`);
    }
    writeOutput(result, options);
    process.exit(EXIT_SUCCESS);
  } catch (error) {
    if (!options.quiet) {
      console.error('Error:', (error as Error).message);
    }
    process.exit(error instanceof probability.ProbabilityInputError ? EXIT_INVALID_BUNDLE : EXIT_ENGINE_ERROR);
  }
}

/**
 * Main CLI setup
 */
function main(): void {
  const program = new Command();

  program
    .name('uvrn')
    .description('UVRN CLI — bundle → receipt, receipt checks, receipted probability')
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

  program
    .command('verify-receipt [receipt]')
    .description('Fully verify a NetworkReceipt (uvrn-receipt-4): hash recompute + Ed25519 signature')
    .option('-k, --key <base64>', 'Producer public key (base64 raw 32 bytes) for signature verification')
    .option('--human', 'Also print the human view (verdict, claim, headline)')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-q, --quiet', 'Suppress informational messages')
    .option('-p, --pretty', 'Pretty-print JSON output')
    .action(verifyNetworkReceiptCommand);

  const prob = program
    .command('prob')
    .description('Probability layer (optional peer @uvrn/probability) — probability, never a V-Score');

  prob
    .command('run [inputs]')
    .description('Compute a receipted probability from cited inputs (file path, URL, or stdin)')
    .option('--key-ref <ref>', 'Sign the receipt; publicKeyRef to record (key read from env)')
    .option('--key-env <name>', `Env var holding the base64 Ed25519 seed (default ${DEFAULT_PROB_KEY_ENV})`)
    .option('--signed-at <iso>', 'Explicit signature timestamp (omitted by default for determinism)')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-q, --quiet', 'Suppress informational messages')
    .option('-p, --pretty', 'Pretty-print JSON output')
    .action(probRunCommand);

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
