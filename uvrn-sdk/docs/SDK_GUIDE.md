# Delta Engine SDK - Complete Guide

This comprehensive guide covers all aspects of using the Delta Engine SDK in your applications.

## Table of Contents

1. [Installation](#installation)
2. [Client Modes](#client-modes)
3. [Building Bundles](#building-bundles)
4. [Executing Bundles](#executing-bundles)
5. [Validation](#validation)
6. [Receipt Verification](#receipt-verification)
7. [Error Handling](#error-handling)
8. [Advanced Usage](#advanced-usage)
9. [Best Practices](#best-practices)

---

## Installation

### npm

```bash
npm install @uvrn/sdk
```

### yarn

```bash
yarn add @uvrn/sdk
```

### pnpm

```bash
pnpm add @uvrn/sdk
```

---

## Client Modes

The SDK supports three execution modes, each optimized for different use cases.

### CLI Mode

Best for: Integration testing, command-line tools, external process isolation

```typescript
import { DeltaEngineClient } from '@uvrn/sdk';

const client = new DeltaEngineClient({
  mode: 'cli',
  cliPath: '/usr/local/bin/uvrn',
  timeout: 30000
});
```

**Setup Requirements:**
```bash
# Install CLI package
npm install -g @uvrn/cli

# Or use locally
npm install --save-dev @uvrn/cli
```

**Pros:**
- Process isolation
- Can use pre-built binaries
- Good for CI/CD pipelines

**Cons:**
- Slower due to process spawning
- Requires CLI installation

### HTTP Mode

Best for: Microservices, distributed systems, production deployments

```typescript
const client = new DeltaEngineClient({
  mode: 'http',
  apiUrl: 'http://localhost:3000',
  timeout: 30000,
  retries: 3
});
```

**Setup Requirements:**
```bash
# Start the API server (default port 3000)
npm install @uvrn/api
npx @uvrn/api
```

**Pros:**
- Centralized engine management
- Scalable with load balancing
- Network-based distribution

**Cons:**
- Requires running server
- Network latency
- Additional infrastructure

### Local Mode

Best for: Development, unit tests, embedded applications

```typescript
const client = new DeltaEngineClient({
  mode: 'local'
});
```

**Setup Requirements:**
```bash
# Core engine is automatically installed as peer dependency
npm install @uvrn/core
```

**Pros:**
- Fastest execution (no IPC/network)
- No external dependencies
- Simplest setup

**Cons:**
- No process isolation
- Shares memory with application

---

## Building Bundles

### Using BundleBuilder (Recommended)

The `BundleBuilder` provides a fluent API for constructing bundles:

```typescript
import { BundleBuilder } from '@uvrn/sdk';

const bundle = new BundleBuilder()
  .setClaim('Q1 revenue matches forecast within 5%')
  .addDataSpecQuick(
    'forecast',
    'Q1 Revenue Forecast',
    'report',
    ['forecast-2024-q1'],
    [
      { key: 'revenue', value: 1000000, unit: 'USD' },
      { key: 'margin', value: 0.25, unit: 'ratio' }
    ]
  )
  .addDataSpecQuick(
    'actual',
    'Q1 Revenue Actual',
    'report',
    ['actuals-2024-q1'],
    [
      { key: 'revenue', value: 1020000, unit: 'USD' },
      { key: 'margin', value: 0.24, unit: 'ratio' }
    ]
  )
  .setThreshold(0.05) // 5% threshold
  .setMaxRounds(5)
  .build();
```

### Manual Bundle Construction

For advanced use cases, construct bundles manually:

```typescript
import type { DeltaBundle, DataSpec } from '@uvrn/sdk';

const bundle: DeltaBundle = {
  bundleId: 'custom-bundle-123',
  claim: 'Sales projections are accurate',
  dataSpecs: [
    {
      id: 'source-1',
      label: 'Projected Sales',
      sourceKind: 'report',
      originDocIds: ['proj-doc-1'],
      metrics: [
        { key: 'total_sales', value: 500000 }
      ]
    },
    {
      id: 'source-2',
      label: 'Actual Sales',
      sourceKind: 'metric',
      originDocIds: ['actual-doc-2'],
      metrics: [
        { key: 'total_sales', value: 485000 }
      ]
    }
  ],
  thresholdPct: 0.10,
  maxRounds: 5
};
```

### Adding Multiple DataSpecs

```typescript
const builder = new BundleBuilder()
  .setClaim('Multi-source revenue verification');

// Add specs from array
const sources = [
  { id: 'source-1', label: 'Source A', value: 1000 },
  { id: 'source-2', label: 'Source B', value: 1050 },
  { id: 'source-3', label: 'Source C', value: 980 }
];

sources.forEach(source => {
  builder.addDataSpecQuick(
    source.id,
    source.label,
    'report',
    [`doc-${source.id}`],
    [{ key: 'revenue', value: source.value }]
  );
});

const bundle = builder.build();
```

---

## Executing Bundles

### Basic Execution

```typescript
const receipt = await client.runEngine(bundle);

console.log('Outcome:', receipt.outcome); // 'consensus' or 'indeterminate'
console.log('Final Delta:', receipt.deltaFinal);
console.log('Receipt Hash:', receipt.hash);
```

### With Error Handling

```typescript
import { ValidationError, ExecutionError } from '@uvrn/sdk';

try {
  const receipt = await client.runEngine(bundle);

  if (receipt.outcome === 'consensus') {
    console.log('✓ Consensus reached');
    console.log('  Delta:', receipt.deltaFinal);
    console.log('  Rounds:', receipt.rounds.length);
  } else {
    console.log('✗ Indeterminate outcome');
    console.log('  Final delta exceeded threshold');
  }

} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid bundle:', error.errors);
  } else if (error instanceof ExecutionError) {
    console.error('Execution failed:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Processing Multiple Bundles

```typescript
async function processBundles(bundles: DeltaBundle[]) {
  const results = await Promise.allSettled(
    bundles.map(bundle => client.runEngine(bundle))
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Bundle ${index}: ${result.value.outcome}`);
    } else {
      console.error(`Bundle ${index} failed:`, result.reason);
    }
  });
}
```

---

## Validation

### Validate Before Execution

Always validate bundles before sending to reduce errors:

```typescript
const validation = await client.validateBundle(bundle);

if (!validation.valid) {
  console.error('Bundle is invalid:');
  validation.errors?.forEach(error => {
    console.error(`  - ${error.field}: ${error.message}`);
  });
  return;
}

// Bundle is valid, safe to execute
const receipt = await client.runEngine(bundle);
```

### Builder Auto-Validation

`BundleBuilder.build()` automatically validates:

```typescript
try {
  const bundle = builder.build(); // Throws if invalid
  const receipt = await client.runEngine(bundle);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Bundle configuration error:', error.errors);
  }
}
```

### Manual Validation Without Building

```typescript
const validation = builder.validate();

if (!validation.valid) {
  // Fix errors before building
  console.error('Configuration errors:', validation.errors);
}
```

---

## Receipt Verification

### Hash Verification

Verify a receipt hasn't been tampered with:

```typescript
import { verifyReceiptHash } from '@uvrn/sdk';

const isValid = verifyReceiptHash(receipt);

if (!isValid) {
  console.error('⚠️ Receipt has been tampered with!');
}
```

### Full Verification

```typescript
const verification = await client.verifyReceipt(receipt);

console.log('Verified:', verification.verified);
console.log('Deterministic:', verification.deterministic);
console.log('Original Hash:', verification.originalHash);

if (!verification.verified) {
  console.error('Verification failed:', verification.error);
}
```

### Storing Receipts

Receipts are designed to be serializable:

```typescript
// Save to file
import { writeFile } from 'fs/promises';
await writeFile('receipt.json', JSON.stringify(receipt, null, 2));

// Save to database
await db.receipts.insert({
  bundleId: receipt.bundleId,
  outcome: receipt.outcome,
  hash: receipt.hash,
  data: JSON.stringify(receipt),
  createdAt: new Date()
});
```

---

## Error Handling

### Error Types

The SDK provides specific error classes for different failure modes:

```typescript
import {
  DeltaEngineError,      // Base class
  ValidationError,        // Bundle/receipt validation failed
  ExecutionError,         // Engine execution failed
  NetworkError,           // HTTP request failed (HTTP mode)
  ConfigurationError      // Invalid client configuration
} from '@uvrn/sdk';
```

### Comprehensive Error Handling

```typescript
try {
  const receipt = await client.runEngine(bundle);

} catch (error) {
  if (error instanceof ValidationError) {
    // Bundle structure is invalid
    console.error('Validation failed:');
    error.errors.forEach(e => {
      console.error(`  ${e.field}: ${e.message}`);
    });

  } else if (error instanceof ExecutionError) {
    // Engine crashed or CLI failed
    console.error('Execution error:', error.message);
    if (error.exitCode) {
      console.error('Exit code:', error.exitCode);
    }
    if (error.stderr) {
      console.error('stderr:', error.stderr);
    }

  } else if (error instanceof NetworkError) {
    // HTTP request failed (HTTP mode only)
    console.error('Network error:', error.message);
    console.error('Status:', error.statusCode);
    console.error('Response:', error.response);

  } else if (error instanceof ConfigurationError) {
    // Client misconfigured
    console.error('Configuration error:', error.message);

  } else if (error instanceof DeltaEngineError) {
    // Generic Delta Engine error
    console.error('Engine error:', error.message);

  } else {
    // Unknown error
    console.error('Unexpected error:', error);
  }
}
```

### Retry Logic

HTTP mode has built-in retries, but you can add custom retry logic:

```typescript
async function executeWithRetry(
  client: DeltaEngineClient,
  bundle: DeltaBundle,
  maxRetries = 3
): Promise<DeltaReceipt> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.runEngine(bundle);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof ValidationError) {
        // Don't retry validation errors
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

---

## Advanced Usage

### Timeout Configuration

```typescript
const client = new DeltaEngineClient({
  mode: 'http',
  apiUrl: 'http://localhost:3000',
  timeout: 60000, // 60 seconds for large bundles
  retries: 5
});
```

### Switching Modes Dynamically

```typescript
function createClient(env: string): DeltaEngineClient {
  if (env === 'production') {
    return new DeltaEngineClient({
      mode: 'http',
      apiUrl: process.env.DELTA_API_URL!,
      timeout: 30000
    });
  } else if (env === 'test') {
    return new DeltaEngineClient({
      mode: 'local'
    });
  } else {
    return new DeltaEngineClient({
      mode: 'cli',
      cliPath: './node_modules/.bin/uvrn'
    });
  }
}
```

### Batch Processing with Concurrency Control

```typescript
async function processBatchWithLimit(
  bundles: DeltaBundle[],
  concurrency: number
): Promise<DeltaReceipt[]> {
  const results: DeltaReceipt[] = [];
  const queue = [...bundles];

  async function worker() {
    while (queue.length > 0) {
      const bundle = queue.shift();
      if (bundle) {
        const receipt = await client.runEngine(bundle);
        results.push(receipt);
      }
    }
  }

  // Run workers concurrently
  await Promise.all(
    Array(concurrency).fill(null).map(() => worker())
  );

  return results;
}

// Process 100 bundles, 5 at a time
const receipts = await processBatchWithLimit(bundles, 5);
```

### Custom Validation Rules

```typescript
import { validateBundle } from '@uvrn/sdk';
import type { DeltaBundle, ValidationResult } from '@uvrn/sdk';

function validateBundleWithBusinessRules(bundle: DeltaBundle): ValidationResult {
  // First, standard validation
  const standardResult = validateBundle(bundle);
  if (!standardResult.valid) {
    return standardResult;
  }

  // Then, custom business rules
  const errors = [];

  // Rule: Must have at least 2 data sources
  if (bundle.dataSpecs.length < 2) {
    errors.push({
      field: 'dataSpecs',
      message: 'Business rule: Must have at least 2 data sources for comparison'
    });
  }

  // Rule: Threshold must not exceed 20%
  if (bundle.thresholdPct > 0.20) {
    errors.push({
      field: 'thresholdPct',
      message: 'Business rule: Threshold cannot exceed 20%'
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

---

## Best Practices

### 1. Always Validate Before Execution

```typescript
// ✓ Good
const validation = await client.validateBundle(bundle);
if (validation.valid) {
  const receipt = await client.runEngine(bundle);
}

// ✗ Bad
const receipt = await client.runEngine(bundle); // May fail with cryptic errors
```

### 2. Use BundleBuilder for Construction

```typescript
// ✓ Good - validation happens automatically
const bundle = new BundleBuilder()
  .setClaim('...')
  .addDataSpec(...)
  .build(); // Throws if invalid

// ✗ Bad - easy to create invalid bundles
const bundle = { bundleId: '...', /* missing required fields */ };
```

### 3. Store Receipt Hashes

```typescript
// ✓ Good - can verify integrity later
await db.receipts.insert({
  bundleId: receipt.bundleId,
  hash: receipt.hash,
  outcome: receipt.outcome,
  fullReceipt: JSON.stringify(receipt)
});

// Later...
const stored = await db.receipts.findOne({ bundleId });
const isValid = verifyReceiptHash(JSON.parse(stored.fullReceipt));
```

### 4. Handle Errors Gracefully

```typescript
// ✓ Good - specific error handling
try {
  return await client.runEngine(bundle);
} catch (error) {
  if (error instanceof ValidationError) {
    // Log and return user-friendly error
    logger.warn('Invalid bundle', { errors: error.errors });
    throw new UserFacingError('Bundle validation failed');
  } else if (error instanceof NetworkError) {
    // Retry or fail gracefully
    logger.error('Network error, will retry', { error });
    return retryExecution(bundle);
  }
  throw error;
}
```

### 5. Use Appropriate Mode for Environment

```typescript
// ✓ Good - mode based on environment
const client = new DeltaEngineClient({
  mode: process.env.NODE_ENV === 'production' ? 'http' : 'local',
  apiUrl: process.env.DELTA_API_URL
});
```

### 6. Set Reasonable Timeouts

```typescript
// ✓ Good - higher timeout for production
const client = new DeltaEngineClient({
  mode: 'http',
  apiUrl: process.env.API_URL!,
  timeout: 60000, // 60s for large bundles
  retries: 3
});
```

### 7. Log Receipt Hashes

```typescript
// ✓ Good - audit trail
const receipt = await client.runEngine(bundle);
logger.info('Bundle executed', {
  bundleId: receipt.bundleId,
  outcome: receipt.outcome,
  hash: receipt.hash,
  rounds: receipt.rounds.length
});
```

---

## Migration Guide

### From Direct Core Usage

If you're currently using `@uvrn/core` directly:

**Before:**
```typescript
import { runDeltaEngine } from '@uvrn/core';
const receipt = runDeltaEngine(bundle);
```

**After:**
```typescript
import { DeltaEngineClient } from '@uvrn/sdk';
const client = new DeltaEngineClient({ mode: 'local' });
const receipt = await client.runEngine(bundle);
```

---

## Troubleshooting

### "Cannot find module '@uvrn/core'"

**Solution:** Install the peer dependency:
```bash
npm install @uvrn/core
```

### CLI Mode: "Failed to spawn CLI"

**Solution:** Verify CLI path:
```typescript
// Check if CLI exists
import { access } from 'fs/promises';
const cliPath = '/usr/local/bin/uvrn';
await access(cliPath); // Throws if doesn't exist

const client = new DeltaEngineClient({ mode: 'cli', cliPath });
```

### HTTP Mode: Network timeouts

**Solution:** Increase timeout and retries:
```typescript
const client = new DeltaEngineClient({
  mode: 'http',
  apiUrl: 'http://localhost:3000',
  timeout: 60000, // 60 seconds
  retries: 5
});
```

---

## Next Steps

- Explore [examples](../examples/) for complete working code
- Read [API documentation](./api/) for detailed type definitions
- Check out [Delta Engine Core](https://github.com/uvrn/uvrn-core) for engine details

---

**Questions or issues?** [Open an issue](https://github.com/uvrn/uvrn-core/issues)
