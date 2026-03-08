# Claude Desktop Integration Guide

This guide explains how to integrate the Delta Engine MCP server with Claude Desktop.

## Prerequisites

- **Claude Desktop** installed (macOS, Windows, or Linux)
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Delta Engine MCP** package installed (globally or locally)

## Installation Methods

### Method 1: Global Installation (Recommended)

Install the package globally for easy access:

```bash
npm install -g @uvrn/mcp
```

### Method 2: Local Installation

Install in a project directory:

```bash
npm install @uvrn/mcp
```

### Method 3: npx (No Installation)

Use npx to run on-demand (Claude Desktop will download as needed):

```bash
# No installation required - npx handles it
```

## Configuration

### Step 1: Locate Claude Desktop Config File

The configuration file location varies by operating system:

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Edit Configuration File

Open `claude_desktop_config.json` in a text editor and add the Delta Engine MCP server:

#### Option A: Using npx (Recommended - No Installation Required)

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"]
    }
  }
}
```

#### Option B: Using Global Installation

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "uvrn-mcp"
    }
  }
}
```

#### Option C: Using Local Installation

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "node",
      "args": ["/absolute/path/to/node_modules/@uvrn/mcp/dist/index.js"]
    }
  }
}
```

#### Option D: With Custom Environment Variables

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"],
      "env": {
        "LOG_LEVEL": "debug",
        "STORAGE_PATH": "/path/to/receipts",
        "MAX_BUNDLE_SIZE": "20971520"
      }
    }
  }
}
```

### Step 3: Restart Claude Desktop

After editing the configuration:

1. **Quit Claude Desktop** completely
2. **Restart Claude Desktop**
3. The Delta Engine MCP server will start automatically

## Verification

After restarting Claude Desktop, verify the integration:

### Check Available Tools

Ask Claude:
```
What MCP tools do you have available?
```

You should see:
- `delta_run_engine`
- `delta_validate_bundle`
- `delta_verify_receipt`

### Test a Tool

Try running a simple validation:

```
Use the delta_validate_bundle tool to check if this bundle structure is valid:
{
  "bundleId": "test-001",
  "claim": "Testing MCP integration",
  "dataSpecs": [...],
  "thresholdPct": 0.1
}
```

## Usage Examples

### Example 1: Validate a Bundle

```
Please validate this DeltaBundle structure:
{
  "bundleId": "market-data-2024-01",
  "claim": "Q4 revenue across sources",
  "dataSpecs": [
    {
      "id": "source-a",
      "label": "Source A",
      "sourceKind": "report",
      "originDocIds": ["doc-123"],
      "metrics": [
        { "key": "revenue", "value": 1000000 }
      ]
    },
    {
      "id": "source-b",
      "label": "Source B", 
      "sourceKind": "report",
      "originDocIds": ["doc-456"],
      "metrics": [
        { "key": "revenue", "value": 1050000 }
      ]
    }
  ],
  "thresholdPct": 0.1
}
```

### Example 2: Run the Delta Engine

```
Use delta_run_engine to process this bundle and tell me if the sources agree:
{
  "bundleId": "consensus-check-001",
  "claim": "User growth metrics alignment",
  "dataSpecs": [...],
  "thresholdPct": 0.05,
  "maxRounds": 3
}
```

### Example 3: Verify a Receipt

```
Verify this receipt's integrity:
{
  "bundleId": "test-001",
  "deltaFinal": 0.048,
  "sources": ["Source A", "Source B"],
  "rounds": [...],
  "outcome": "consensus",
  "hash": "abc123..."
}
```

### Example 4: Use Prompts

```
Use the verify_data prompt to help me verify this claim:
Claim: "Website traffic increased 50% in Q4"
Sources: "Google Analytics, Internal Dashboard, Third-party Tracker"
```

## Troubleshooting

### Server Not Starting

**Check Claude Desktop logs:**

macOS:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Common issues:**
- Node.js version < 18.0.0
- npm package not installed
- Incorrect path in configuration
- Syntax error in JSON config

### Tools Not Appearing

1. **Verify configuration syntax** - JSON must be valid
2. **Check server name** - Must be unique in `mcpServers`
3. **Restart Claude Desktop** - Full quit and restart
4. **Check permissions** - Config file must be writable

### Connection Errors

**Enable debug logging:**

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

Check logs for detailed error messages.

### Performance Issues

**Increase max bundle size:**

```json
{
  "env": {
    "MAX_BUNDLE_SIZE": "52428800"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `STORAGE_PATH` | (none) | Optional path for caching receipts |
| `MAX_BUNDLE_SIZE` | `10485760` | Maximum bundle size in bytes (10MB) |
| `VERBOSE_ERRORS` | `false` | Include stack traces in error responses |

## Advanced Configuration

### Multiple MCP Servers

You can run multiple MCP servers simultaneously:

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"]
    },
    "other-server": {
      "command": "other-mcp-server"
    }
  }
}
```

### Custom Logging

```json
{
  "mcpServers": {
    "delta-engine": {
      "command": "npx",
      "args": ["-y", "@uvrn/mcp"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Security Considerations

- **Local execution only** - MCP server runs locally on your machine
- **No external network calls** - All processing is local
- **No data persistence** - Phase A.3 does not store data (future phases may add optional storage)
- **Input validation** - All bundles validated before processing

## Getting Help

- **Documentation:** See package README.md
- **Issues:** https://github.com/uvrn/lc_delta-core/issues
- **MCP Specification:** https://modelcontextprotocol.io/

## Next Steps

Once configured, explore:
1. **Prompt templates** - Use built-in prompts for common tasks
2. **Resource access** - Retrieve schemas via `mcp://delta-engine/schema/*`
3. **Batch processing** - Process multiple bundles in sequence
4. **Integration** - Combine with other MCP tools in Claude Desktop

---

**Loosechain** - _Receipts are truth. Interfaces are untrusted. Verification comes first._
