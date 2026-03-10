# uvrn-packages

Monorepo for **UVRN** (Universal Verification Receipts for Nything) protocol packages. Published to npm under the `@uvrn` scope.

## Getting started

- **Delta Engine (library):** `npm install @uvrn/core @uvrn/sdk`
- **CLI:** `npm install -g @uvrn/cli` then `delta-engine run bundle.json`
- **REST API:** `npm install @uvrn/api` then `npx @uvrn/api` (server on port 3000)
- **MCP (AI assistants):** `npm install @uvrn/mcp` and add to your MCP client config
- **DRVC3 signing:** `npm install @uvrn/core @uvrn/adapter` to wrap receipts in signed envelopes

See each package README for install, usage, and use cases.

## Packages on npm

| Package | What it is | Install |
| -------- | ---------- | ------- |
| [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) | Delta Engine core (run, validate, verify) | `npm install @uvrn/core` |
| [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) | TypeScript SDK (CLI / HTTP / local modes) | `npm install @uvrn/sdk` |
| [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) | Command-line (bundle → receipt) | `npm install -g @uvrn/cli` |
| [@uvrn/api](https://www.npmjs.com/package/@uvrn/api) | REST API server | `npm install @uvrn/api` |
| [@uvrn/mcp](https://www.npmjs.com/package/@uvrn/mcp) | MCP server for AI assistants | `npm install @uvrn/mcp` |
| [@uvrn/adapter](https://www.npmjs.com/package/@uvrn/adapter) | DRVC3 envelope adapter (EIP-191) | `npm install @uvrn/adapter` |
| [@uvrn/delta-engine-core](https://www.npmjs.com/package/@uvrn/delta-engine-core) | Same as @uvrn/core | Use `@uvrn/core` for consistency |
| [@uvrn/delta-engine-sdk](https://www.npmjs.com/package/@uvrn/delta-engine-sdk) | Same as @uvrn/sdk (programmatic) | Use `@uvrn/sdk` for consistency |

**Naming:** `@uvrn/core` and `@uvrn/delta-engine-core` are the same package (Delta Engine core). `@uvrn/sdk` and `@uvrn/delta-engine-sdk` (programmatic client) are the same. Prefer **@uvrn/core** and **@uvrn/sdk** for consistency.

## Structure

```
uvrn-packages/
├── uvrn-core/      # Engine core (deterministic protocol)
├── uvrn-sdk/       # TypeScript SDK
├── uvrn-cli/       # CLI (bundle → receipt)
├── uvrn-api/       # REST API server
├── uvrn-mcp/       # MCP server
├── uvrn-adapter/   # DRVC3 envelope adapter
└── docs/           # Shared documentation
```

## Install

```bash
pnpm install
```

## Build

```bash
pnpm run build
```

## Publish

Publish in dependency order: **@uvrn/core** first, then **@uvrn/sdk**, **@uvrn/adapter**, **@uvrn/mcp**, **@uvrn/api**, **@uvrn/cli**. See `docs/reports/` for publish notes (e.g. `2026-03-08-npm-first-publish.md`).

## License

MIT
