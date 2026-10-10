# @uvrn/cli

Command-line interface for the UVRN Delta Engine. Transform data bundles into integrity-checkable receipts using deterministic comparison and canonical hashing.

**Package provides:** The `uvrn` command; `run`, `validate`, `verify`, `verify-receipt`, and `prob run` subcommands; bundle input from file, stdin, or URL; receipt output to file or stdout. Uses `@uvrn/core` under the hood.

**You provide:** A bundle (JSON file, stdin, or URL). Optional: output path, `--pretty`, `--quiet`. No storage. A signing key is needed only for `uvrn prob run --key-ref` (read from an environment variable, never argv).

**Version:** 5.1.1.

## What's new in 5.1.0

- **`uvrn prob run`** — receipted probability from cited market / base-rate inputs, through the
  optional peer `@uvrn/probability` (`^0.1.0 || ^0.2.0 || ^0.3.0`). See [`uvrn prob run`](#uvrn-prob-run-inputs).

## Install

`@uvrn/core` and `@uvrn/receipt` (`^5.1.0`) are peer dependencies; npm 7+ installs them
automatically. `uvrn prob run` also needs the optional peer `@uvrn/probability`:

```bash
npm install -g @uvrn/cli @uvrn/probability
```

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

`uvrn verify` only recomputes the hash, so a `true` result means the receipt is
**integrity-checked**. The `verified` key is the legacy DeltaReceipt output field; no producer
signature is checked. For a signed NetworkReceipt use `uvrn verify-receipt`.

### `uvrn verify-receipt [receipt]`

Fully verify a NetworkReceipt (`uvrn-receipt-4`): hash recompute plus Ed25519 signature check.
`verified` is `true` only when integrity **and** the signature check out; an unsigned or
unverifiable-signature receipt reports `integrityOk: true, verified: false`.

**Options:**
- `-k, --key <base64>` - Producer public key (base64, raw 32 bytes) for the signature check
- `--human` - Also print the human view (verdict, claim, headline)
- `-o, --output <file>`, `-q, --quiet`, `-p, --pretty` - as above

```bash
uvrn verify-receipt network-receipt.json --key <base64-public-key> --pretty
```

Output fields: `verified`, `integrityOk`, `signed`, `signatureOk`, `error`, `hash`.

**Exit codes:**
- **With `--key`** (you asked for signature verification): `0` only when the receipt is
  **verified** — the hash recomputes **and** the signature checks out against that key. A wrong
  key, a forged or altered signature, or an unsigned receipt exits `2`, even though integrity
  checks out (`integrityOk: true, verified: false`). Safe to gate CI on the exit code.
- **Without `--key`**: integrity-only. `0` when the hash recomputes (the receipt is
  **integrity-checked** only; `verified` is always `false` without a key), `2` when it does not. Do not treat exit `0` without `--key` as signature verification.
- `3` - I/O error (unreadable file, invalid JSON).

### `uvrn prob run [inputs]`

Receipted probability from cited market / base-rate inputs (SPEC `uvrn-probability-v1`).
Requires the optional peer `@uvrn/probability` (`npm install @uvrn/probability`). The result is a
probability, never a V-Score.

The input is a `uvrn-probability-input-1` JSON document (an `outcome.outcomeHash`, an `asOf` with
a cited source, and a cited `market` and/or `baserate`). The command calls the package's legacy
`runProbability` entry point; the version 2 / 3 `runForecast` contracts are library-only for now.
Without `--key-ref` the receipt is unsigned (integrity-checkable only); with it, the receipt is
signed and can be verified with `uvrn verify-receipt`.

Default thresholds are **PROVISIONAL** and recorded in the result (`inputs` role `thresholds`, `provisional: true`).

**Options:**
- `--key-ref <ref>` - Sign the receipt, recording this `publicKeyRef`
- `--key-env <name>` - Env var holding the base64 Ed25519 seed (default `UVRN_PROB_PRIVATE_KEY`)
- `--signed-at <iso>` - Explicit signature timestamp (omitted by default so output stays deterministic)
- `-o, --output <file>`, `-q, --quiet`, `-p, --pretty` - as above

```bash
uvrn prob run inputs.json --pretty
UVRN_PROB_PRIVATE_KEY=... uvrn prob run inputs.json --key-ref acme-pk-2026-v1
```

Exit codes: `0` for any result, including `insufficient_basis` refusals; `1` when the input cannot be
bound to an outcome or instant; `3` for I/O errors, a missing peer, or a missing key.

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
- Receipt hash replay (integrity check)
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

Apache License 2.0 — see [LICENSE](LICENSE). If you redistribute this package or a work derived from it, include the attribution notices from [NOTICE](NOTICE) (in short: "Built on UVRN").

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-cli`)
- [CLI Guide](https://github.com/UVRN-org/uvrn-packages/blob/main/uvrn-cli/docs/CLI_GUIDE.md) — extended guide for `run`, `validate`, and `verify` (`verify-receipt` and `prob run` are documented above)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — core engine library
- [@uvrn/api](https://www.npmjs.com/package/@uvrn/api) — REST API server (published)
- [@uvrn/mcp](https://www.npmjs.com/package/@uvrn/mcp) — MCP server for AI assistants (published)
- [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) — TypeScript SDK (published)
