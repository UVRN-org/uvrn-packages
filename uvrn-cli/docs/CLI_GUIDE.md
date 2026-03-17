# UVRN Delta Engine CLI - Comprehensive Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
4. [Command Reference](#command-reference)
5. [Input/Output Formats](#inputoutput-formats)
6. [Workflows & Examples](#workflows--examples)
7. [Integration Patterns](#integration-patterns)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

The UVRN Delta Engine CLI provides command-line access to Layer-1 protocol functionality. It transforms data bundles into cryptographically verifiable receipts without requiring any adapter code or external data sources.

### What Does It Do?

The CLI performs three core operations:

1. **Validation** - Verify bundle structure conforms to protocol schema
2. **Execution** - Run the delta engine and produce a receipt
3. **Verification** - Replay receipt hash computation to ensure integrity

### Protocol Guarantees

- **Determinism**: Same bundle → same receipt → same hash
- **No External Calls**: Pure computation, no network/file I/O during execution
- **Layer-1 Only**: No adapter logic, no data collection, no enrichment

---

## Installation

### Global Installation

```bash
npm install -g @uvrn/cli
```

Verify installation:

```bash
uvrn --version
# Output: 1.0.0
```

### Local/Project Installation

```bash
npm install @uvrn/cli --save-dev
```

Use with npx:

```bash
npx uvrn --version
```

### From Source

```bash
git clone https://github.com/uvrn/lc_delta-core.git
cd lc_delta-core
git checkout phase-a/cli-v1
npm install
npm run build --workspace=@uvrn/cli
node packages/uvrn-cli/dist/cli.js --version
```

---

## Core Concepts

### Bundles

A **DeltaBundle** is the input to the engine. It contains:

- Multiple data sources (DataSpec[])
- A claim being verified
- A variance threshold

### Receipts

A **DeltaReceipt** is the output. It contains:

- Computed deltas (variances)
- Round-by-round analysis
- Consensus outcome
- Cryptographic hash

### The Delta Engine

The engine compares metrics across sources and computes variances. If variance stays within the threshold, the bundle achieves **consensus**. Otherwise, it's **indeterminate**.

---

## Command Reference

### `uvrn run`

**Purpose**: Execute the delta engine on a bundle.

**Syntax**:
```bash
uvrn run [bundle] [options]
```

**Arguments**:
- `[bundle]` - Path to bundle file, URL, or omit for stdin

**Options**:
- `-o, --output <file>` - Write receipt to file
- `-q, --quiet` - Suppress console messages
- `-p, --pretty` - Pretty-print JSON

**Examples**:

```bash
# File input
uvrn run bundle.json

# Pretty output to file
uvrn run bundle.json --output receipt.json --pretty

# Stdin input
cat bundle.json | uvrn run

# URL input
uvrn run https://example.com/data/bundle.json

# Quiet mode (only JSON output)
uvrn run bundle.json --quiet
```

**Exit Codes**:
- `0` - Success (consensus achieved)
- `1` - Invalid bundle structure
- `2` - Engine error
- `3` - I/O error

---

### `uvrn validate`

**Purpose**: Validate bundle structure without running engine.

**Syntax**:
```bash
uvrn validate [bundle] [options]
```

**Arguments**:
- `[bundle]` - Path to bundle file, URL, or omit for stdin

**Options**:
- `-o, --output <file>` - Write result to file
- `-q, --quiet` - Suppress console messages
- `-p, --pretty` - Pretty-print JSON

**Examples**:

```bash
# Basic validation
uvrn validate bundle.json

# With detailed output
uvrn validate bundle.json --pretty
```

**Output Format**:

Valid bundle:
```json
{
  "valid": true
}
```

Invalid bundle:
```json
{
  "valid": false,
  "error": "thresholdPct must be > 0 and <= 1"
}
```

**Exit Codes**:
- `0` - Bundle is valid
- `1` - Bundle is invalid
- `3` - I/O error

---

### `uvrn verify`

**Purpose**: Verify receipt integrity by recomputing hash.

**Syntax**:
```bash
uvrn verify [receipt] [options]
```

**Arguments**:
- `[receipt]` - Path to receipt file, URL, or omit for stdin

**Options**:
- `-o, --output <file>` - Write result to file
- `-q, --quiet` - Suppress console messages
- `-p, --pretty` - Pretty-print JSON

**Examples**:

```bash
# Verify receipt
uvrn verify receipt.json

# Pretty output
uvrn verify receipt.json --pretty
```

**Output Format**:

Valid receipt:
```json
{
  "verified": true,
  "hash": "36247244c63f58e0b2908d2fad115f60677f29b59b67665579b9b6e8db727791"
}
```

Invalid receipt:
```json
{
  "verified": false,
  "error": "Hash mismatch. Provided: abc..., Computed: def...",
  "providedHash": "abc123...",
  "recomputedHash": "def456..."
}
```

**Exit Codes**:
- `0` - Receipt is valid
- `2` - Receipt verification failed
- `3` - I/O error

---

## Input/Output Formats

### Reading Input

The CLI supports three input methods:

#### 1. File Path
```bash
uvrn run /path/to/bundle.json
```

Both relative and absolute paths work:
```bash
uvrn run ./data/bundle.json
uvrn run ~/bundles/bundle.json
```

#### 2. Stdin
```bash
cat bundle.json | uvrn run
echo '{"bundleId":"test",...}' | uvrn run
curl https://api.example.com/bundle | uvrn run
```

Use `-` explicitly:
```bash
uvrn run - < bundle.json
```

#### 3. URL
```bash
uvrn run https://example.com/bundle.json
uvrn run http://localhost:3000/api/bundle
```

Supports both HTTP and HTTPS.

### Writing Output

#### 1. Stdout (Default)
```bash
uvrn run bundle.json
# Prints JSON to console
```

#### 2. File
```bash
uvrn run bundle.json --output receipt.json
# Writes to receipt.json
```

#### 3. Pretty Print
```bash
uvrn run bundle.json --pretty
# Formatted JSON with indentation
```

#### 4. Quiet Mode
```bash
uvrn run bundle.json --quiet
# No status messages, only JSON
```

---

## Workflows & Examples

### Basic Verification Workflow

```bash
# Step 1: Validate bundle structure
uvrn validate bundle.json
# ✓ Bundle is valid

# Step 2: Run engine
uvrn run bundle.json --output receipt.json
# Generates receipt

# Step 3: Verify receipt
uvrn verify receipt.json
# ✓ Receipt is valid
```

### CI/CD Integration

```bash
#!/bin/bash
# verify-security-scan.sh

BUNDLE="security-scan-bundle.json"
RECEIPT="security-scan-receipt.json"

# Validate bundle
if ! uvrn validate "$BUNDLE" --quiet; then
  echo "ERROR: Invalid bundle structure"
  exit 1
fi

# Run engine
if uvrn run "$BUNDLE" --output "$RECEIPT" --quiet; then
  echo "✓ Security scan achieved consensus"

  # Verify receipt integrity
  uvrn verify "$RECEIPT" --quiet

  # Archive receipt with timestamp
  cp "$RECEIPT" "archive/receipt-$(date +%Y%m%d-%H%M%S).json"
else
  echo "✗ Security scan failed to reach consensus"
  echo "Review variance in receipt details"
  exit 1
fi
```

### Batch Processing

```bash
#!/bin/bash
# Process multiple bundles

for bundle in bundles/*.json; do
  name=$(basename "$bundle" .json)
  receipt="receipts/${name}-receipt.json"

  echo "Processing $name..."

  if uvrn run "$bundle" --output "$receipt" --quiet; then
    echo "  ✓ Generated $receipt"
  else
    echo "  ✗ Failed to process $bundle"
  fi
done
```

### Data Pipeline Integration

```bash
# Fetch data → Build bundle → Run engine → Store receipt

curl -X POST https://api.example.com/collect \
  -H "Content-Type: application/json" \
  -d '{"sources": ["github", "npm", "security-db"]}' | \
  uvrn run --output receipt.json --pretty

# Then push receipt to storage
aws s3 cp receipt.json s3://receipts/$(date +%Y-%m-%d)/receipt.json
```

---

## Integration Patterns

### Node.js Scripts

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

// Build bundle
const bundle = {
  bundleId: 'script-001',
  claim: 'Verify metrics',
  thresholdPct: 0.05,
  dataSpecs: [/* ... */]
};

fs.writeFileSync('bundle.json', JSON.stringify(bundle));

// Run CLI
try {
  const receipt = execSync('uvrn run bundle.json --quiet', {
    encoding: 'utf-8'
  });

  const receiptObj = JSON.parse(receipt);
  console.log('Outcome:', receiptObj.outcome);
  console.log('Hash:', receiptObj.hash);
} catch (error) {
  console.error('Engine failed:', error.message);
}
```

### Python Integration

```python
import subprocess
import json

# Load bundle
with open('bundle.json', 'r') as f:
    bundle = json.load(f)

# Run CLI
result = subprocess.run(
    ['uvrn', 'run', 'bundle.json', '--quiet'],
    capture_output=True,
    text=True
)

if result.returncode == 0:
    receipt = json.loads(result.stdout)
    print(f"Outcome: {receipt['outcome']}")
    print(f"Hash: {receipt['hash']}")
else:
    print(f"Error: {result.stderr}")
```

### Shell Functions

```bash
# Add to .bashrc or .zshrc

# Shorthand for validate + run + verify
verify-bundle() {
  local bundle="$1"
  local receipt="${2:-receipt.json}"

  uvrn validate "$bundle" && \
  uvrn run "$bundle" --output "$receipt" && \
  uvrn verify "$receipt"
}

# Usage:
# verify-bundle bundle.json output-receipt.json
```

---

## Advanced Usage

### Combining with jq

```bash
# Extract specific fields
uvrn run bundle.json | jq '.outcome'
# "consensus"

uvrn run bundle.json | jq '.deltaFinal'
# 0.01980198

# Filter rounds
uvrn run bundle.json | jq '.rounds[] | select(.withinThreshold == false)'
```

### Environment Variables

```bash
# Set default output directory
export DELTA_ENGINE_OUTPUT_DIR="./receipts"

# Wrapper script
uvrn run bundle.json --output "$DELTA_ENGINE_OUTPUT_DIR/receipt.json"
```

### Parallel Execution

```bash
# Process multiple bundles in parallel (GNU parallel)
ls bundles/*.json | parallel -j 4 \
  'uvrn run {} --output receipts/{/.}-receipt.json'
```

### Streaming JSON

```bash
# Process newline-delimited JSON
while IFS= read -r bundle; do
  echo "$bundle" | uvrn run --quiet
done < bundles.ndjson > receipts.ndjson
```

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module '@uvrn/core'"

**Solution**: Rebuild the workspace:
```bash
cd /path/to/monorepo
npm run build
```

#### Issue: "Invalid JSON for bundle"

**Solution**: Validate JSON syntax:
```bash
cat bundle.json | jq .
```

#### Issue: "thresholdPct must be > 0 and <= 1"

**Solution**: Check your threshold value:
```json
{
  "thresholdPct": 0.05  // Valid: 5%
}
```

Not:
```json
{
  "thresholdPct": 5  // Invalid: Must be 0.0 to 1.0
}
```

#### Issue: "dataSpecs must be an array with at least 2 items"

**Solution**: Ensure at least 2 data sources:
```json
{
  "dataSpecs": [
    { "id": "source-1", /* ... */ },
    { "id": "source-2", /* ... */ }
  ]
}
```

### Debug Mode

Enable verbose logging:

```bash
# Node.js debug
NODE_DEBUG=* uvrn run bundle.json
```

### Checking Exit Codes

```bash
uvrn run bundle.json
case $? in
  0) echo "Success" ;;
  1) echo "Invalid bundle" ;;
  2) echo "Engine error" ;;
  3) echo "I/O error" ;;
esac
```

---

## Best Practices

1. **Always validate before running**: Use `validate` to catch structural issues early
2. **Use --quiet in scripts**: Suppress console output for cleaner automation
3. **Store receipts with timestamps**: Archive receipts for audit trails
4. **Verify receipts after generation**: Ensure hash integrity immediately
5. **Use semantic bundle IDs**: Make bundleId descriptive (e.g., `security-scan-2024-01-14`)

---

## Next Steps

- Explore the [API Server](../../uvrn-api/README.md) for HTTP access
- Learn about [MCP Integration](../../uvrn-mcp/README.md) for AI agents
- Read the [Protocol Specification](../../../admin/docs/compass/PROTOCOL.md)

---

## Support

- Repository: https://github.com/uvrn/lc_delta-core
- Issues: https://github.com/uvrn/lc_delta-core/issues
- Protocol Docs: See `/admin/docs/compass/` in repository
