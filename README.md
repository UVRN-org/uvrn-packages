# uvrn-packages

Monorepo for **UVRN** (Universal Verification Receipt Network) protocol packages. Published to npm under the `@uvrn` scope.

**Disclaimer:** UVRN is in Alpha testing. The engine measures whether your sources agree with each other — not whether they’re correct. Final trust of output rests with the user. Use at your own risk. Have fun.

*UVRN makes no claims to "truth", the "verification" is the output of math — it is up to any user to decide if claim is actually "true" — Research and testing are absolutely recommended per use case and individual system!!*

## Getting started

- **Delta Engine (library):** `npm install @uvrn/core @uvrn/sdk`
- **CLI:** `npm install -g @uvrn/cli` then `uvrn run bundle.json`
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
├── docs/           # Shared documentation
└── guides/         # Workflows and protocols
```

**Safe updates (preserve older version):** To make changes while keeping a frozen copy in another folder, use [Git worktrees](guides/Git_Worktree_Protocol_Universal_Template.md). One directory stays at the preserved state; do new work in a second worktree (e.g. `uvrn-packages-next`).

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

## Open source

**Open source:** Source code and issues are on GitHub: [uvrn-packages](https://github.com/UVRN-org/uvrn-packages) (monorepo). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

## License

MIT
