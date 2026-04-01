# @uvrn/cli

Command-line interface for the UVRN Delta Engine. Transform data bundles into verifiable receipts using deterministic comparison and canonical hashing.

**Package provides:** The `uvrn` command; `run`, `validate`, `verify` subcommands; bundle input from file, stdin, or URL; receipt output to file or stdout. Uses `@uvrn/core` under the hood.

**You provide:** A bundle (JSON file, stdin, or URL). Optional: output path, `--pretty`, `--quiet`. No signer or storage — engine only.

## Install

### Global Installation (Recommended)

```bash
npm install -g @uvrn/cli
```

After installation, the `uvrn` command will be available globally:

```bash
uvrn --version
```

### Local Installation

```bash
npm install @uvrn/cli
```

Then use with npx:

```bash
npx uvrn --version
```

## Quick Start

1. **Create a bundle** (JSON file with your data):

```json
{
  "bundleId": "example-001",
  "claim": "Verify data consistency",
  "thresholdPct": 0.05,
  "dataSpecs": [
    {
      "id": "source-a",
      "label": "Source A",
      "sourceKind": "metric",
      "originDocIds": ["doc-a"],
      "metrics": [{ "key": "value", "value": 100 }]
    },
    {
      "id": "source-b",
      "label": "Source B",
      "sourceKind": "metric",
      "originDocIds": ["doc-b"],
      "metrics": [{ "key": "value", "value": 102 }]
    }
  ]
}
```

2. **Run the engine**:

```bash
uvrn run bundle.json
```

3. **Get your receipt** (with deterministic hash). Example output:

```json
{
  "bundleId": "example-001",
  "deltaFinal": 0.01980198,
  "sources": ["Source A", "Source B"],
  "rounds": [...],
  "outcome": "consensus",
  "hash": "36247244c63f58e0b2908d2fad115f60677f29b59b67665579b9b6e8db727791"
}
```

## Commands

### `uvrn run [bundle]`

Execute the delta engine on a bundle and generate a receipt.

**Input Sources:**
- File path: `uvrn run bundle.json`
- Stdin: `cat bundle.json | uvrn run`
- URL: `uvrn run https://example.com/bundle.json`

**Options:**
- `-o, --output <file>` - Write output to file instead of stdout
- `-q, --quiet` - Suppress informational messages
- `-p, --pretty` - Pretty-print JSON output

**Examples:**

```bash
# Basic usage
uvrn run bundle.json

# Save receipt to file with pretty formatting
uvrn run bundle.json --output receipt.json --pretty

# Pipe from stdin
cat bundle.json | uvrn run --pretty

# Fetch bundle from URL
uvrn run https://api.example.com/bundle.json
```

**Exit Codes:**
- `0` - Success
- `1` - Invalid bundle
- `2` - Engine error
- `3` - I/O error

### `uvrn validate [bundle]`

Validate bundle structure without running the engine.

**Options:**
- `-o, --output <file>` - Write output to file instead of stdout
- `-q, --quiet` - Suppress informational messages
- `-p, --pretty` - Pretty-print JSON output

**Examples:**

```bash
# Validate bundle structure
uvrn validate bundle.json

# Quiet mode (only output JSON)
uvrn validate bundle.json --quiet

# Output validation result to file
uvrn validate bundle.json --output validation.json
```

**Output:**

```json
{
  "valid": true
}
```

Or if invalid:

```json
{
  "valid": false,
  "error": "dataSpecs must be an array with at least 2 items"
}
```

### `uvrn verify [receipt]`

Verify receipt integrity by replaying hash computation.

**Options:**
- `-o, --output <file>` - Write output to file instead of stdout
- `-q, --quiet` - Suppress informational messages
- `-p, --pretty` - Pretty-print JSON output

**Examples:**

```bash
# Verify receipt integrity
uvrn verify receipt.json

# Verify with pretty output
uvrn verify receipt.json --pretty
```

**Output:**

```json
{
  "verified": true,
  "hash": "36247244c63f58e0b2908d2fad115f60677f29b59b67665579b9b6e8db727791"
}
```

Or if verification fails:

```json
{
  "verified": false,
  "error": "Hash mismatch. Provided: abc123..., Computed: def456...",
  "providedHash": "abc123...",
  "recomputedHash": "def456..."
}
```

## Bundle Schema

A valid DeltaBundle must have:

- `bundleId` (string) - Unique identifier for this bundle
- `claim` (string) - Human-readable claim being verified
- `thresholdPct` (number) - Acceptable variance threshold (0.0 to 1.0)
- `dataSpecs` (array) - At least 2 data sources with:
  - `id` (string) - Unique source identifier
  - `label` (string) - Human-readable source name
  - `sourceKind` (string) - One of: 'report', 'metric', 'chart', 'meta'
  - `originDocIds` (array) - Source document identifiers
  - `metrics` (array) - Metrics with:
    - `key` (string) - Metric name
    - `value` (number) - Metric value
    - `unit` (string, optional) - Unit of measurement
    - `ts` (string, optional) - ISO timestamp

**Optional:**
- `maxRounds` (number) - Maximum consensus rounds (default: 5)

## Receipt Schema

A DeltaReceipt includes:

- `bundleId` (string) - Original bundle identifier
- `deltaFinal` (number) - Final variance across all metrics
- `sources` (array) - Source labels in deterministic order
- `rounds` (array) - Round-by-round computation results
- `outcome` (string) - Either 'consensus' or 'indeterminate'
- `hash` (string) - SHA-256 hash of canonical receipt payload
- `suggestedFixes` (array) - Always empty in Layer-1 (future Layer-2 feature)
- `ts` (string, optional) - Timestamp if provided

## Environment Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

## Use Cases

### Data Verification Pipelines

```bash
# Validate → Run → Verify pipeline
uvrn validate bundle.json && \
uvrn run bundle.json --output receipt.json && \
uvrn verify receipt.json
```

### CI/CD Integration

```bash
# In your CI script
if uvrn run security-scan.json --output receipt.json --quiet; then
  echo "Security scan passed consensus threshold"
  uvrn verify receipt.json
else
  echo "Security scan failed - investigate discrepancies"
  exit 1
fi
```

### Stream Processing

```bash
# Process multiple bundles
for bundle in data/*.json; do
  echo "Processing $bundle..."
  uvrn run "$bundle" --output "receipts/$(basename $bundle .json)-receipt.json"
done
```

## Error Handling

The CLI uses standard exit codes and provides clear error messages:

```bash
# Check exit code
uvrn run bundle.json
if [ $? -eq 0 ]; then
  echo "Success"
elif [ $? -eq 1 ]; then
  echo "Invalid bundle structure"
elif [ $? -eq 2 ]; then
  echo "Engine execution error"
elif [ $? -eq 3 ]; then
  echo "I/O error (file not found, network issue, etc.)"
fi
```

## Use cases

- **Run comparisons from the shell** — Pass a bundle file, stdin, or URL; get a receipt with outcome and hash.
- **Validate before running** — Use `uvrn validate bundle.json` to check structure without executing.
- **Verify receipts** — Use `uvrn verify receipt.json` to recompute the hash and confirm integrity.
- **CI and scripts** — Pipe bundles in and receipts out; use exit codes for success or failure.

## Protocol compliance

This CLI implements the UVRN Delta Engine protocol:

- Deterministic hash computation (SHA-256)
- Canonical JSON serialization
- Receipt replay verification
- Zero external dependencies in engine logic

## Troubleshooting

### "Cannot find module" errors

Make sure dependencies are installed:

```bash
npm install
npm run build
```

### "Invalid JSON" errors

Validate your JSON syntax:

```bash
cat bundle.json | jq .
```

### Permission errors on Unix/Linux

Make the CLI executable:

```bash
chmod +x node_modules/.bin/uvrn
```

## License

MIT

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-cli`)
- [CLI Guide](docs/CLI_GUIDE.md) — full command reference
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — core engine library
- [@uvrn/api](https://www.npmjs.com/package/@uvrn/api) — REST API server (published)
- [@uvrn/mcp](https://www.npmjs.com/package/@uvrn/mcp) — MCP server for AI assistants (published)
- [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) — TypeScript SDK (published)
