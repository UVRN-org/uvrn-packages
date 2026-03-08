# uvrn-packages

Monorepo for **UVRN** (Universal Verification Receipts for Nything) protocol packages. Published to npm under the `@uvrn` scope.

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

## Consumers

- **Lyrikai Node** and other LK projects consume these packages from npm (`@uvrn/core`, `@uvrn/sdk`, etc.). Node acts as director of forces; this repo is the canonical source and publishes to npm.

## Publish to GitHub (UVRN-org)

All packages are intended to live under [UVRN-org](https://github.com/orgs/UVRN-org/repositories):

- **Option A**: Push this monorepo as **uvrn-packages** to `https://github.com/UVRN-org/uvrn-packages`.
- **Option B**: Create one repo per package: **uvrn-delta-engine-core** (for `@uvrn/core`), **uvrn-sdk**, **uvrn-cli**, **uvrn-api**, **uvrn-mcp**, **uvrn-adapter**, then split or mirror from this repo.

New versions: use **1.0.0** (or next semver) for first NPM publish; publish **@uvrn/core** first, then dependents. Full plan (version order, Option A vs B): see Lyrikai Node `admin/docs/build-plans/BP-UVRN-GITHUB-AND-NPM-PUBLISH.md`. First publish checklist and report: see `docs/reports/` (e.g. `2026-03-08-npm-first-publish.md`).

## License

MIT
