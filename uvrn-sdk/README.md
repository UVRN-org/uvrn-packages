# @uvrn/sdk

TypeScript SDK for [UVRN Delta Engine](https://github.com/uvrn/uvrn-core) (formerly Loosechain) — programmatic access to deterministic verification and consensus computation.

## Overview

The Delta Engine SDK provides a developer-friendly interface to interact with the Loosechain Delta Engine in multiple execution modes:

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
  .setClaim('Q1 revenue matches forecast within 5%')
  .addDataSpecQuick(
    'forecast',
    'Q1 Forecast',
    'report',
    ['forecast-doc-123'],
    [{ key: 'revenue', value: 1000000, unit: 'USD' }]
  )
  .addDataSpecQuick(
    'actual',
    'Q1 Actual',
    'report',
    ['actuals-doc-456'],
    [{ key: 'revenue', value: 1020000, unit: 'USD' }]
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
  .setClaim('Sales projections are accurate')
  .addDataSpec({
    id: 'source-1',
    label: 'Projected Sales',
    sourceKind: 'report',
    originDocIds: ['proj-123'],
    metrics: [{ key: 'total_sales', value: 500000 }]
  })
  .addDataSpec({
    id: 'source-2',
    label: 'Actual Sales',
    sourceKind: 'report',
    originDocIds: ['actual-456'],
    metrics: [{ key: 'total_sales', value: 485000 }]
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
  cliPath: '/usr/local/bin/delta-engine', // or './node_modules/.bin/delta-engine'
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

## Documentation

- [SDK Guide](./docs/SDK_GUIDE.md) - Comprehensive usage guide
- [API Documentation](./docs/api/) - Generated TypeDoc documentation
- [Delta Engine Core](https://github.com/uvrn/uvrn-core) - Core engine documentation

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for TypeScript projects)

## License

MIT

## Contributing

Contributions are welcome! Please see the main repository for contribution guidelines.

## Support

- GitHub Issues: [Report a bug](https://github.com/uvrn/uvrn-core/issues)
- Documentation: [Full documentation](https://github.com/uvrn/uvrn-core/tree/main/docs)

---

Built with ❤️ by the Loosechain team
