# Environment Configuration

This document describes all environment variables used by the Delta Engine MCP server.

## Configuration File

> [!IMPORTANT]
> The MCP server reads configuration from `process.env` **only**. It does not automatically load `.env` files.
> 
> To use a `.env` file during development, you must load it externally before starting the server (e.g., using `dotenv-cli` or your shell).

**For reference only** (not automatically loaded):
```bash
cp .env.example .env
# Edit .env with your settings
# Load it manually: dotenv -- node dist/index.js
```

## Environment Variables

### LOG_LEVEL

**Description:** Controls the verbosity of server logging

**Type:** String (enum)

**Valid Values:** `debug`, `info`, `warn`, `error`

**Default:** `info`

**Example:**
```bash
LOG_LEVEL=debug
```

**Usage:**
- `debug` - Detailed diagnostic information (all logs)
- `info` - General informational messages (recommended for production)
- `warn` - Warning messages only
- `error` - Error messages only

**Notes:**
- Logs are written to stderr (compatible with MCP stdio transport)
- Debug mode may impact performance
- Use `info` or `warn` for production deployments

---

### STORAGE_PATH

**Description:** Optional directory path for caching receipts and bundles

**Type:** String (file path)

**Valid Values:** Any valid directory path

**Default:** (none - storage disabled)

**Example:**
```bash
STORAGE_PATH=/var/data/delta-engine/receipts
```

**Usage:**
- When set, receipts may be cached to disk (future feature)
- Directory must exist and be writable
- Absolute paths recommended

**Notes:**
- **Phase A.3:** Storage not yet implemented (placeholder)
- **Future phases:** Will enable receipt/bundle persistence
- Leave unset for stateless operation

---

### MAX_BUNDLE_SIZE

**Description:** Maximum size of bundle JSON in bytes

**Type:** Integer (bytes)

**Valid Values:** Positive integer

**Default:** `10485760` (10 MB)

**Example:**
```bash
MAX_BUNDLE_SIZE=20971520  # 20 MB
```

**Usage:**
- Prevents processing of excessively large bundles
- Helps prevent memory exhaustion
- Adjust based on your typical bundle sizes

**Notes:**
- Large bundles may cause performance degradation
- Consider your available RAM when setting
- 10 MB accommodates most use cases

---

### VERBOSE_ERRORS

**Description:** Include stack traces and detailed debug info in error responses

**Type:** Boolean

**Valid Values:** `true`, `false`

**Default:** `false`

**Example:**
```bash
VERBOSE_ERRORS=true
```

**Usage:**
- `true` - Include full stack traces in error messages
- `false` - Return user-friendly error messages only

**Notes:**
- Enable during development for debugging
- Disable in production to avoid information leakage
- Does not affect logging to stderr

---

## Configuration Examples

### Development Environment

```bash
# .env for development
LOG_LEVEL=debug
VERBOSE_ERRORS=true
MAX_BUNDLE_SIZE=52428800
```

### Production Environment

```bash
# .env for production
LOG_LEVEL=warn
VERBOSE_ERRORS=false
MAX_BUNDLE_SIZE=10485760
```

### Testing Environment

```bash
# .env for testing
LOG_LEVEL=error
VERBOSE_ERRORS=true
MAX_BUNDLE_SIZE=1048576
```

## Loading Configuration

### How Configuration is Loaded

The server reads from `process.env` on startup. There is **no automatic `.env` file loading**:

```typescript
import { config } from './config';

console.log(config.logLevel);      // From process.env.LOG_LEVEL
console.log(config.maxBundleSize); // From process.env.MAX_BUNDLE_SIZE
```

### Setting Environment Variables

**Shell export (Linux/macOS):**
```bash
export LOG_LEVEL=debug
export MAX_BUNDLE_SIZE=20971520
node dist/index.js
```

**Inline (one-time):**
```bash
LOG_LEVEL=debug node dist/index.js
```

**Using dotenv-cli (requires installation):**
```bash
npm install -g dotenv-cli
dotenv -- node dist/index.js
```

### Claude Desktop Integration

When using with Claude Desktop, set variables in the config file:

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"],
      "env": {
        "LOG_LEVEL": "debug",
        "MAX_BUNDLE_SIZE": "20971520",
        "VERBOSE_ERRORS": "true"
      }
    }
  }
}
```

## Validation

The server validates all environment variables on startup:

**Invalid values will cause startup failure:**
```
Error: Invalid LOG_LEVEL: verbose. Must be one of: debug, info, warn, error
```

**Type checking:**
- String values validated against allowed values
- Numeric values parsed and range-checked
- Boolean values accept `true`/`false` only

## Future Configuration Options

The following options are planned for future phases:

### CACHE_TTL (Planned)
```bash
CACHE_TTL=900  # Cache receipts for 15 minutes
```

### RATE_LIMIT (Planned)
```bash
RATE_LIMIT=100  # Max 100 requests per minute
```

### AUTH_TOKEN (Planned)
```bash
AUTH_TOKEN=your-secret-token  # Authentication
```

### WEBHOOK_URL (Planned)
```bash
WEBHOOK_URL=https://example.com/hooks  # Event notifications
```

---

## Best Practices

### ✅ Do

- Use `.env` files for local development
- Set environment-specific values in deployment configs
- Validate configuration before deployment
- Use reasonable limits for `MAX_BUNDLE_SIZE`
- Enable debug logging during troubleshooting

### ❌ Don't

- Commit `.env` files to version control
- Use `debug` logging in production
- Set `VERBOSE_ERRORS=true` in production
- Set `MAX_BUNDLE_SIZE` too high (risk of OOM)
- Ignore startup validation errors

---

## Troubleshooting

### Server won't start

**Check environment variable syntax:**
```bash
echo $LOG_LEVEL
```

**Verify values are valid:**
```bash
LOG_LEVEL=invalid node dist/index.js
# Error: Invalid LOG_LEVEL: invalid...
```

### Unexpected logging behavior

**Verify LOG_LEVEL is set:**
```bash
env | grep LOG_LEVEL
```

**Check effective configuration:**
```bash
LOG_LEVEL=debug node -e "require('./dist/config').config"
```

### Performance issues

**Try reducing MAX_BUNDLE_SIZE:**
```bash
MAX_BUNDLE_SIZE=5242880  # 5 MB
```

**Enable debug logging to diagnose:**
```bash
LOG_LEVEL=debug
```

---

**Related Documentation:**
- [README.md](./README.md) - Package overview
- [CLAUDE_DESKTOP_SETUP.md](./CLAUDE_DESKTOP_SETUP.md) - Integration guide
- [.env.example](./.env.example) - Example configuration

---

**Loosechain** - _Receipts are truth. Interfaces are untrusted. Verification comes first._
