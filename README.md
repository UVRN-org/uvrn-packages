# uvrn-packages

The public TypeScript monorepo for the **Universal Verification Receipt Network (UVRN)**: a 20-package open protocol for scoring claim consensus, producing deterministic receipts, tracking drift over time, and distributing verification results across apps, agents, APIs, CLIs, and embeds.

UVRN measures whether your selected sources agree with each other. It does not declare objective truth.

## What UVRN Does

UVRN gives developers a portable protocol for:

- turning source evidence into deterministic Delta receipts
- scoring consensus with a transparent V-Score formula
- signing, canonizing, comparing, and monitoring receipts
- wiring your own data sources, storage, identity, alerting, and delivery surfaces
- exposing results through SDKs, APIs, MCP servers, CLIs, and embeddable badges

The protocol is modular by design. Install one package or compose the full stack.

## Quick Start

Install the package that matches the surface you need:

```bash
# Core deterministic Delta engine
npm install @uvrn/core

# TypeScript application/client integration
npm install @uvrn/sdk

# Command line receipt generation
npm install -g @uvrn/cli

# Self-hosted HTTP API or AI-agent MCP access
npm install @uvrn/api
npm install @uvrn/mcp
```

For a fuller pipeline, compose the source, consensus, scoring, receipt, drift, and distribution layers:

```bash
npm install \
  @uvrn/farm \
  @uvrn/normalize \
  @uvrn/consensus \
  @uvrn/core \
  @uvrn/score \
  @uvrn/drift \
  @uvrn/canon
```

Each package has its own README with the minimum install set, usage examples, and package-specific contracts.

## Protocol Model

UVRN is organized into four layers:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4 — Distribution & Access                                │
│  @uvrn/embed  @uvrn/watch  @uvrn/mcp  @uvrn/api  @uvrn/cli      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — Temporal & Lifecycle                                 │
│  @uvrn/drift  @uvrn/agent  @uvrn/canon  @uvrn/timeline          │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — Receipt & Verification                               │
│  @uvrn/core  @uvrn/sdk  @uvrn/adapter  @uvrn/score              │
│  @uvrn/compare  @uvrn/identity  @uvrn/test                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1 — Data & Consensus                                     │
│  @uvrn/farm  @uvrn/consensus  @uvrn/normalize  @uvrn/signal     │
└─────────────────────────────────────────────────────────────────┘
```

Typical flow:

```text
Source evidence
  → @uvrn/farm / @uvrn/normalize       data ingestion and normalization
  → @uvrn/consensus                     source aggregation and component mapping
  → @uvrn/core                          deterministic Delta receipt generation
  → @uvrn/score                         V-Score calculation
  → @uvrn/adapter / @uvrn/canon         signed receipt envelope and canonization
  → @uvrn/drift / @uvrn/agent           temporal monitoring
  → @uvrn/watch / @uvrn/embed / @uvrn/api / @uvrn/mcp / @uvrn/cli
```

Explicit sibling package couplings are documented in [COUPLINGS.md](COUPLINGS.md).

## V-Score

`@uvrn/core` is the Delta engine. It computes deterministic convergence across source evidence and returns Delta receipts. `@uvrn/consensus` maps source statistics into named scoring components, and `@uvrn/score` owns the canonical V-Score weights.

```text
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

`@uvrn/drift` imports those canonical weights from `@uvrn/score` when recomputing score changes over time.

## Package Catalog

All 20 protocol packages are published under the `@uvrn` npm scope.

| Package | Version | Layer | Role |
|---------|---------|-------|------|
| [`@uvrn/core`](uvrn-core/README.md) | 1.0.2 | 2 | Deterministic Delta engine, validation, and DRVC3 receipts |
| [`@uvrn/sdk`](uvrn-sdk/README.md) | 1.0.2 | 2 | TypeScript SDK for submitting claims and reading receipts |
| [`@uvrn/adapter`](uvrn-adapter/README.md) | 1.0.2 | 2 | DRVC3 envelope adapter with EIP-191 signatures |
| [`@uvrn/mcp`](uvrn-mcp/README.md) | 1.0.2 | 4 | MCP server for AI-agent-native bundle processing |
| [`@uvrn/api`](uvrn-api/README.md) | 1.0.2 | 4 | Fastify REST API for self-hosted UVRN deployments |
| [`@uvrn/cli`](uvrn-cli/README.md) | 1.0.2 | 4 | CLI for turning bundles into receipts |
| [`@uvrn/drift`](uvrn-drift/README.md) | 2.0.0 | 3 | Temporal decay scoring and freshness drift tracking |
| [`@uvrn/consensus`](uvrn-consensus/README.md) | 1.1.0 | 1 | Multi-source signal aggregation |
| [`@uvrn/agent`](uvrn-agent/README.md) | 1.0.0 | 3 | Continuous claim monitoring loop |
| [`@uvrn/canon`](uvrn-canon/README.md) | 1.0.0 | 3 | Canonization engine for permanent signed records |
| [`@uvrn/signal`](uvrn-signal/README.md) | 1.0.0 | 1 | Typed internal event bus |
| [`@uvrn/score`](uvrn-score/README.md) | 1.0.0 | 2 | V-Score breakdowns and domain profiles |
| [`@uvrn/test`](uvrn-test/README.md) | 1.0.0 | 2 | Mocks, fixtures, and factory functions |
| [`@uvrn/farm`](uvrn-farm/README.md) | 1.0.0 | 1 | Standardized data source connectors |
| [`@uvrn/normalize`](uvrn-normalize/README.md) | 1.0.0 | 1 | Source normalization layer |
| [`@uvrn/compare`](uvrn-compare/README.md) | 1.0.0 | 2 | Cross-receipt comparison and divergence tracking |
| [`@uvrn/identity`](uvrn-identity/README.md) | 1.0.0 | 2 | Signer reputation layer |
| [`@uvrn/timeline`](uvrn-timeline/README.md) | 1.0.0 | 3 | Time-series query layer for consensus history |
| [`@uvrn/watch`](uvrn-watch/README.md) | 1.0.0 | 4 | Subscription and threshold alerts |
| [`@uvrn/embed`](uvrn-embed/README.md) | 1.0.0 | 4 | Embeddable React badge and plain JavaScript widget |

## Provider-Agnostic Interfaces

UVRN packages are built around interface contracts, not vendor lock-in. The protocol logic stays independent from any specific API, database, wallet, queue, storage backend, or notification provider.

| Package | Interface | You provide |
|---------|-----------|-------------|
| `@uvrn/farm` | `FarmConnector` | Any data source: API, feed, scraper, archive, database, or custom stream |
| `@uvrn/canon` | `CanonStore` | Any persistence layer: SQL, KV, object storage, IPFS, or in-memory store |
| `@uvrn/identity` | `IdentityStore` | Any signer identity and reputation backend |
| `@uvrn/timeline` | `TimelineStore` | Any time-series or historical receipt store |
| `@uvrn/watch` | `NotifyTarget` | Any delivery target: callback, webhook, Slack, Discord, email, queue, or custom notifier |
| `@uvrn/embed` | `apiUrl` | Any UVRN-compatible API endpoint |

Reference implementations are included as examples. They are starting points, not required infrastructure.

## Use The Monorepo Locally

This repository uses pnpm workspaces and Node.js 18+.

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
```

Build one package:

```bash
pnpm --filter @uvrn/core run build
```

The workspace list is defined in [pnpm-workspace.yaml](pnpm-workspace.yaml), and package metadata lives in each package's `package.json`.

## Repository Structure

```text
uvrn-packages/
├── package.json              root workspace scripts and package list
├── pnpm-workspace.yaml       pnpm workspace package registry
├── ROADMAP.md                public protocol specs for all 20 packages
├── COUPLINGS.md              documented cross-package contracts
├── uvrn-core/                deterministic Delta engine
├── uvrn-sdk/                 TypeScript SDK
├── uvrn-adapter/             signed receipt adapter
├── uvrn-mcp/                 MCP server
├── uvrn-api/                 REST API
├── uvrn-cli/                 command line interface
├── uvrn-drift/               temporal scoring
├── uvrn-agent/               monitoring loop
├── uvrn-canon/               canonization layer
├── uvrn-signal/              event bus
├── uvrn-score/               V-Score package
├── uvrn-test/                testing helpers
├── uvrn-farm/                source connectors
├── uvrn-normalize/           source normalization
├── uvrn-consensus/           signal aggregation
├── uvrn-compare/             receipt comparison
├── uvrn-identity/            signer reputation
├── uvrn-timeline/            historical queries
├── uvrn-watch/               alerts and subscriptions
└── uvrn-embed/               embeddable badge/widget
```

## Reference Docs

- [ROADMAP.md](ROADMAP.md) — full package specs, interface contracts, and design notes
- [COUPLINGS.md](COUPLINGS.md) — explicit sibling dependencies and data contracts
- Package READMEs — install instructions, usage examples, and public APIs
- Package CHANGELOGs — release history for each package

## Open Source

Source code and issues: [UVRN-org/uvrn-packages](https://github.com/UVRN-org/uvrn-packages)

License: MIT — UVRN-org

Disclaimer: UVRN is in Alpha. It measures agreement across the sources you provide, not whether those sources are correct. Final trust of any output rests with the user.
