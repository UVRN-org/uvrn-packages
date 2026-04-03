# TypeScript Client Examples

This directory contains TypeScript examples demonstrating how to use the Delta Engine SDK.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run examples:

```bash
# Basic usage
npm run basic

# Validation examples
npm run validation

# Verification examples
npm run verification

# Bundle builder examples
npm run builder
```

## Examples

### basic-usage.ts
Demonstrates the fundamental workflow:
- Creating a client
- Building a bundle
- Executing and receiving a receipt
- Verifying the receipt

### validation.ts
Shows validation techniques:
- Validating bundles before execution
- Handling validation errors
- Custom validation logic

### verification.ts
Covers receipt verification:
- Hash integrity checking
- Determinism verification
- Receipt storage and retrieval

### builder.ts
Explores BundleBuilder features:
- Fluent API usage
- Multiple data specs
- Validation during building
- Different construction patterns

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0

## Learn More

- [SDK Guide](../../docs/SDK_GUIDE.md)
- [API Documentation](../../docs/api/)
- [Main README](../../README.md)
