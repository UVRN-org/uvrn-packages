# @uvrn/sdk

TypeScript SDK for the [UVRN Delta Engine](https://github.com/UVRN-org/uvrn-packages) — programmatic access to deterministic verification and consensus computation.

**Disclaimer:** UVRN is in Alpha testing. The engine measures whether your sources agree with each other — not whether they’re correct. Final trust of output rests with the user. Use at your own risk. Have fun.

## Overview

The Delta Engine SDK provides a developer-friendly interface to interact with the Delta Engine in multiple execution modes:

- **CLI Mode**: Spawn the CLI executable as a child process
- **HTTP Mode**: Make REST API calls to a running Delta Engine server
- **Local Mode**: Direct import and execution of the core engine

## Installation

```bash
npm install @uvrn/sdk
```

## Quick Start

### TypeScript Example

```typescript
import { DeltaEngineClient, BundleBuilder } from '@uvrn/sdk';

// Create a client (choose your mode)
const client = new DeltaEngineClient({
  mode: 'http',
  apiUrl: 'http://localhost:3000',
  timeout: 30000
});

// Build a bundle
const bundle = new BundleBuilder()
  .setClaim('Metrics from source-a and source-b agree within 5%')
  .addDataSpecQuick(
    'source-a',
    'Source A',
    'report',
    ['doc-001'],
    [{ key: 'total', value: 1000, unit: 'count' }]
  )
  .addDataSpecQuick(
    'source-b',
    'Source B',
    'report',
    ['doc-002'],
    [{ key: 'total', value: 1020, unit: 'count' }]
  )
  .setThreshold(0.05)
  .build();

// Execute the bundle
const receipt = await client.runEngine(bundle);

console.log('Outcome:', receipt.outcome);
console.log('Delta:', receipt.deltaFinal);
console.log('Hash:', receipt.hash);
```

### JavaScript Example (ES Modules)

```javascript
import { DeltaEngineClient, BundleBuilder } from '@uvrn/sdk';

const client = new DeltaEngineClient({
  mode: 'local'
});

const bundle = new BundleBuilder()
  .setClaim('Metrics from two sources agree within 10%')
  .addDataSpec({
    id: 'source-1',
    label: 'Source One',
    sourceKind: 'report',
    originDocIds: ['doc-001'],
    metrics: [{ key: 'total', value: 500 }]
  })
  .addDataSpec({
    id: 'source-2',
    label: 'Source Two',
    sourceKind: 'report',
    originDocIds: ['doc-002'],
    metrics: [{ key: 'total', value: 485 }]
  })
  .setThresholdPercent(10)
  .build();

const receipt = await client.runEngine(bundle);
console.log('Result:', receipt);
```

### JavaScript Example (CommonJS)

```javascript
const { DeltaEngineClient, BundleBuilder } = require('@uvrn/sdk');

// ... same as ES modules example
```

## Client Modes

### CLI Mode

Spawns the Delta Engine CLI as a child process:

```typescript
const client = new DeltaEngineClient({
  mode: 'cli',
  cliPath: '/usr/local/bin/uvrn', // or './node_modules/.bin/uvrn'
  timeout: 30000
});
```

**Requirements:**
- Delta Engine CLI must be installed
- `cliPath` must point to the executable

### HTTP Mode

Makes REST API calls to a running Delta Engine server:

```typescript
const client = new DeltaEngineClient({
  mode: 'http',
  apiUrl: 'http://localhost:3000',
  timeout: 30000,
  retries: 3
});
```

**Requirements:**
- Delta Engine API server must be running
- Server must be accessible at `apiUrl`

### Local Mode

Directly imports and executes the core engine:

```typescript
const client = new DeltaEngineClient({
  mode: 'local'
});
```

**Requirements:**
- `@uvrn/core` must be installed

## API Reference

### `DeltaEngineClient`

Main client class for executing bundles and verifying receipts.

#### Constructor

```typescript
new DeltaEngineClient(options: ClientOptions)
```

**Options:**
- `mode`: `'cli' | 'http' | 'local'` - Execution mode
- `cliPath?`: `string` - Path to CLI executable (CLI mode only)
- `apiUrl?`: `string` - API base URL (HTTP mode only)
- `timeout?`: `number` - Request timeout in ms (default: 30000)
- `retries?`: `number` - Retry attempts (default: 3)

#### Methods

**`async runEngine(bundle: DeltaBundle): Promise<DeltaReceipt>`**

Executes a bundle and returns a receipt.

```typescript
const receipt = await client.runEngine(bundle);
```

**`async validateBundle(bundle: DeltaBundle): Promise<ValidationResult>`**

Validates a bundle without executing it.

```typescript
const result = await client.validateBundle(bundle);
if (!result.valid) {
  console.error('Errors:', result.errors);
}
```

**`async verifyReceipt(receipt: DeltaReceipt): Promise<VerificationResult>`**

Verifies a receipt's hash integrity.

```typescript
const result = await client.verifyReceipt(receipt);
if (!result.verified) {
  console.error('Receipt verification failed!');
}
```

### `BundleBuilder`

Fluent API for building Delta Bundles.

#### Methods

**`setClaim(claim: string): this`**

Sets the claim statement.

**`addDataSpec(spec: DataSpec): this`**

Adds a complete DataSpec.

**`addDataSpecQuick(id, label, sourceKind, originDocIds, metrics): this`**

Shorthand for adding a DataSpec.

**`setThreshold(threshold: number): this`**

Sets threshold as decimal (0.0 to 1.0).

**`setThresholdPercent(percent: number): this`**

Sets threshold as percentage (0 to 100).

**`setMaxRounds(rounds: number): this`**

Sets maximum rounds (default: 5).

**`validate(): ValidationResult`**

Validates current configuration.

**`build(): DeltaBundle`**

Builds and returns the bundle (throws if invalid).

## Use cases

- **Run the engine from code** — Use local mode to run comparisons in-process, or HTTP/CLI mode to call a remote server or CLI.
- **Build bundles programmatically** — Use BundleBuilder to construct valid bundles without hand-writing JSON.
- **Validate and verify in pipelines** — Validate bundles before run; verify receipt hashes after run for integrity checks.
- **Integrate into any service** — Same API whether you use CLI, HTTP, or local; switch modes via config.

### Validators

**`validateBundle(bundle: unknown): ValidationResult`**

Validates bundle structure.

**`validateReceipt(receipt: unknown): ValidationResult`**

Validates receipt structure.

**`verifyReceiptHash(receipt: DeltaReceipt): boolean`**

Verifies receipt hash integrity.

## Error Handling

The SDK provides typed error classes:

```typescript
import {
  DeltaEngineError,
  ValidationError,
  ExecutionError,
  NetworkError,
  ConfigurationError
} from '@uvrn/sdk';

try {
  const receipt = await client.runEngine(bundle);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Bundle is invalid:', error.errors);
  } else if (error instanceof ExecutionError) {
    console.error('Execution failed:', error.message, error.exitCode);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.statusCode, error.response);
  } else if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import type {
  DeltaBundle,
  DeltaReceipt,
  DataSpec,
  MetricPoint,
  ClientOptions,
  ValidationResult,
  VerificationResult
} from '@uvrn/sdk';
```

## Examples

See the [examples directory](./examples/) for complete working examples:

- [examples/typescript-client/](./examples/typescript-client/) - TypeScript usage
- [examples/javascript-client/](./examples/javascript-client/) - JavaScript (ESM and CommonJS)
- [examples/error-handling/](./examples/error-handling/) - Error handling patterns
- [examples/batch-processing/](./examples/batch-processing/) - Processing multiple bundles

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-sdk`)
- [SDK Guide](./docs/SDK_GUIDE.md) — comprehensive usage guide
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core (used in local mode)
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line
- [@uvrn/api](https://www.npmjs.com/package/@uvrn/api) — HTTP server for the engine

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for TypeScript projects)

## License

MIT
