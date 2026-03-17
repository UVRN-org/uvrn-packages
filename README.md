# uvrn-packages

Monorepo for **UVRN** (Universal Verification Receipt Network) protocol packages. Published to npm under the `@uvrn` scope. **Release:** @uvrn/api, @uvrn/sdk, @uvrn/mcp 1.5.2; @uvrn/core, @uvrn/adapter, @uvrn/cli 1.5.1.

**Highlights:** Packed `@uvrn/*` manifests use normal semver (no `workspace:`), so `npm install` works in clean projects. CI (`pack-check.yml`) runs a contract test: build, pack, then install from tarballs and run smoke (createServer + health, MCP library import). **@uvrn/api** 1.5.2: `createServer()` no longer crashes without `pino-pretty`; **@uvrn/mcp** and **@uvrn/sdk** follow default-safe behavior (no side effects on import; SDK `VERSION` from package.json). See [CHANGELOG.md](CHANGELOG.md).

**Disclaimer:** UVRN is in Alpha testing. The engine measures whether your sources agree with each other — not whether they’re correct. Final trust of output rests with the user. Use at your own discretion. Have fun.

*UVRN makes no claims to "truth", the "verification" is the output of math — it is up to any user to decide if claim is actually "true" — Research and testing are absolutely recommended per use case and individual system!!*

## Getting started

- **Delta Engine (library):** `npm install @uvrn/core @uvrn/sdk`
- **CLI:** `npm install -g @uvrn/cli` then `uvrn run bundle.json`
- **REST API:** `npm install @uvrn/api` then `npx @uvrn/api` (server on port 3000)
- **MCP (AI assistants):** `npm install @uvrn/mcp` and add to your MCP client config
- **DRVC3 signing:** `npm install @uvrn/core @uvrn/adapter` to wrap receipts in signed envelopes

See each package README for install, usage, and use cases. For version history and notable changes see [CHANGELOG.md](CHANGELOG.md).

## Packages on npm

This repo contains six packages published under the `@uvrn` scope:

| Package | What it is | Install |
| -------- | ---------- | ------- |
| [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) | Delta Engine core (run, validate, verify) | `npm install @uvrn/core` |
| [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) | TypeScript SDK (CLI / HTTP / local modes) | `npm install @uvrn/sdk` |
| [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) | Command-line (bundle → receipt) | `npm install -g @uvrn/cli` |
| [@uvrn/api](https://www.npmjs.com/package/@uvrn/api) | REST API server | `npm install @uvrn/api` |
| [@uvrn/mcp](https://www.npmjs.com/package/@uvrn/mcp) | MCP server for AI assistants | `npm install @uvrn/mcp` |
| [@uvrn/adapter](https://www.npmjs.com/package/@uvrn/adapter) | DRVC3 envelope adapter (EIP-191) | `npm install @uvrn/adapter` |

## Structure

```
uvrn-packages/
├── uvrn-core/      # @uvrn/core — Engine core (deterministic protocol)
├── uvrn-sdk/       # @uvrn/sdk — TypeScript SDK
├── uvrn-cli/       # @uvrn/cli — CLI (bundle → receipt)
├── uvrn-api/       # @uvrn/api — REST API server
├── uvrn-mcp/       # @uvrn/mcp — MCP server for AI assistants
└── uvrn-adapter/   # @uvrn/adapter — DRVC3 envelope adapter
```

## Install

```bash
pnpm install
```

## Build

```bash
pnpm run build
```

**Troubleshooting:** If you see `npm warn Unknown env config "..."` during build, those come from your environment (e.g. `npm_config_*` variables), not from this repo. The build still succeeds; you can ignore the warnings or unset those variables to silence them.

## Publish

Publish in dependency order: **@uvrn/core** first, then **@uvrn/sdk**, **@uvrn/adapter**, **@uvrn/mcp**, **@uvrn/api**, **@uvrn/cli**. Before publishing, run `pnpm run smoke:consumer` to verify install-from-tarball; prepack/postpack scripts rewrite workspace deps to semver in packed manifests. See [CHANGELOG.md](CHANGELOG.md) for version history.

## Open source

**Open source:** Source code and issues are on GitHub: [uvrn-packages](https://github.com/UVRN-org/uvrn-packages) (monorepo). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

## License

MIT
