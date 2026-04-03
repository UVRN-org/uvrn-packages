# UVRN Packages — Master Build Plan
# Phase 2: Full 20-Package Protocol Buildout

**Version**: 1.0
**Created**: 2026-04-01
**Owner**: Suttle Media LLC / UVRN-org
**Protocol**: Bloom Protocol v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Worktree**: `uvrn-packages-next` (active) | `uvrn-packages` (stable reference)

---

## Overview

This build plan covers the construction of the 11 remaining packages needed to complete the UVRN protocol from 9 published packages to 20. It defines:

- Build wave groupings (respecting dependency order)
- Per-package build prompts (for Claude Code / Cursor)
- Audit checkpoints (for OpenAI Codex)
- NPM publish sequence

The full package spec for every package is in `ROADMAP.md` — **that document is the source of truth for interface contracts**. This plan is the execution strategy.

---

## Design Goal: Provider-Agnostic, Open-Source First

All 11 packages being built here are open-source, publicly available on npm, and intended to be useful across any stack. This shapes how they are built:

**The protocol behavior is fixed. The providers are not.**

Every package that touches an external system (data sources, storage, delivery channels) must be built around a **pluggable interface**. Reference implementations using free/open services are included as examples. Users bring their own providers.

**What this means for each build target:**
- `@uvrn/farm`: Build `BaseConnector` + `FarmConnector` interface first. Reference connectors (CoinGecko, Coinbase, etc.) are examples of the pattern — include them, but make it obvious they're swappable.
- `@uvrn/normalize`: The `NormalizationProfile` interface and transformer registry are the product. The four built-in profiles are examples.
- `@uvrn/consensus`: The aggregation logic is the product. `FarmResult` is an input interface — consensus doesn't care where it came from.
- `@uvrn/identity`, `@uvrn/timeline`: The `*Store` interface is what ships. `MockStore` is included for testing. Any storage backend the user implements will work.
- `@uvrn/watch`: The in-process `callback` delivery target is the zero-dependency path. `WebhookDelivery`, `SlackDelivery`, `DiscordDelivery` are reference implementations.
- `@uvrn/embed`: Points at any `apiUrl`. The UMD build has zero dependencies.

**Audit note:** Every audit pass should verify that packages meet the provider-agnostic standard — no hard coupling to specific external services in protocol logic, interfaces clearly documented and exported, reference implementations clearly labeled as examples.

---

## Current State (as of 2026-04-01)

### Live on npm

| Package | Version | Notes |
|---------|---------|-------|
| `@uvrn/core` | 1.6.x | Stable — source of truth for V-Score, types, validation |
| `@uvrn/sdk` | 1.6.x | Stable |
| `@uvrn/adapter` | 1.5.x | Stable — EIP-191 / DRVC3 signing |
| `@uvrn/mcp` | 1.5.x | Stable — AI assistant connector |
| `@uvrn/api` | 1.5.x | Stable — REST API server |
| `@uvrn/cli` | 1.5.x | Stable — CLI tool |

### Pre-Release (built, audited — in this worktree)

| Package | Version | Notes |
|---------|---------|-------|
| `@uvrn/drift` | 1.0.0 | Temporal decay scoring — audited, pre-release |
| `@uvrn/agent` | 1.0.0 | Continuous monitoring loop — audited, pre-release |
| `@uvrn/canon` | 1.0.0 | Canonization engine — audited, pre-release |

### To Build (this plan)

11 new packages across 4 build waves.

---

## Build Waves

Build waves are ordered by dependency. A wave must be complete (built + audited) before the next wave begins. Packages within a wave are independent and can be built in parallel.

---

### Wave 1 — Zero-Dep and Near-Zero-Dep Foundations

**Goal**: Build the infrastructure layer that everything else depends on.
**Packages**: `@uvrn/signal`, `@uvrn/score`, `@uvrn/test`
**Can build in parallel**: YES — all three are independent of each other

| Package | Deps | Priority | Prompt File |
|---------|------|----------|-------------|
| `@uvrn/signal` | Zero deps | P1 | `build-plans/prompts/BUILD-signal.md` |
| `@uvrn/score` | Peer: `@uvrn/core` | P1 | `build-plans/prompts/BUILD-score.md` |
| `@uvrn/test` | Peer devDeps: core, drift, canon | P1 | `build-plans/prompts/BUILD-test.md` |

**Audit checkpoint**: After Wave 1 is complete → Codex audit all three packages
**Audit output**: `.admin/audits/audit-wave1-{date}.md`

---

### Wave 2 — Data Ingestion Layer

**Goal**: Build the data source connectors and normalization layer.
**Packages**: `@uvrn/farm`, `@uvrn/normalize`
**Dependency**: Wave 1 must be complete (especially `@uvrn/test` for mock connectors)
**Can build in parallel**: YES

| Package | Deps | Priority | Prompt File |
|---------|------|----------|-------------|
| `@uvrn/farm` | Peer: core; implements `agent.FarmConnector` | P1 | `build-plans/prompts/BUILD-farm.md` |
| `@uvrn/normalize` | Deps: core; optional peer: farm | P2 | `build-plans/prompts/BUILD-normalize.md` |

**Audit checkpoint**: After Wave 2 → Codex audit farm + normalize
**Critical audit focus**: FarmConnector interface compliance; normalization profile stability

---

### Wave 3 — Aggregation and Cross-Receipt Analysis

**Goal**: Build consensus aggregation and the receipt comparison + identity layers.
**Packages**: `@uvrn/consensus`, `@uvrn/compare`, `@uvrn/identity`
**Dependency**: Wave 2 complete; farm interface stable
**Can build in parallel**: YES

| Package | Deps | Priority | Prompt File |
|---------|------|----------|-------------|
| `@uvrn/consensus` | Deps: core, farm (optional) | P2 | `build-plans/prompts/BUILD-consensus.md` |
| `@uvrn/compare` | Deps: core, drift | P2 | `build-plans/prompts/BUILD-compare.md` |
| `@uvrn/identity` | Deps: core, adapter | P3 | `build-plans/prompts/BUILD-identity.md` |

**Audit checkpoint**: After Wave 3 → Codex audit all three packages

---

### Wave 4 — Distribution and Access Layer

**Goal**: Build the consumer-facing distribution packages.
**Packages**: `@uvrn/timeline`, `@uvrn/watch`, `@uvrn/embed`
**Dependency**: All prior waves complete; timeline needs canon storage; watch needs agent
**Can build in parallel**: YES (mostly — timeline is slightly sequential)

| Package | Deps | Priority | Prompt File |
|---------|------|----------|-------------|
| `@uvrn/timeline` | Deps: core, drift, canon | P3 | `build-plans/prompts/BUILD-timeline.md` |
| `@uvrn/watch` | Deps: agent, drift | P3 | `build-plans/prompts/BUILD-watch.md` |
| `@uvrn/embed` | Peer: core types only | P4 | `build-plans/prompts/BUILD-embed.md` |

**Audit checkpoint**: After Wave 4 → Final full-protocol Codex audit
**Final audit scope**: Full 11-package suite + integration surface between all packages

---

## Bloom Build Cycle (per package)

Every package follows this cycle:

```
PLAN    → Read ROADMAP spec, confirm interface contracts, scaffold package structure
BUILD   → Implement src/types/index.ts → src/index.ts → implementation modules → tests
CHECK   → pnpm run build; pnpm run test; smoke install from tarball
UPDATE  → Update CHANGELOG.md, README.md, package.json; update pnpm-workspace.yaml
REFLECT → Write findings to admin/docs/findings/ if anything surprising found
CONTINUE → Hand to Codex for audit; move to next package
```

---

## Package Independence Standards

Every package built must meet these independence criteria:

1. **Installable standalone**: `npm install @uvrn/{name}` works cleanly
2. **Documented minimal install**: README shows the minimum install needed to use this package
3. **Peer dep hygiene**: `@uvrn/*` cross-deps are `peerDependencies`, not `dependencies`
4. **No forced bundling**: installing one package does not silently install unrelated ones
5. **Smoke test**: `npm install @uvrn/{name}` from tarball + basic usage in clean project
6. **Provider-agnostic**: any package with external integrations must work without a specific external service — via mock, in-memory, or free/open reference implementation
7. **Interface exported**: pluggable interfaces (`FarmConnector`, `*Store`, `NotifyTarget`) must be exported from `src/types/index.ts` so users can implement them without knowing implementation details

---

## Post-Build: NPM Prep Checklist (all packages)

When all 11 packages pass their audits and the final wave-4 audit is clean:

- [ ] Update root `README.md` to reflect all 20 packages
- [ ] Update root `pnpm-workspace.yaml` to include all 11 new packages
- [ ] Run full monorepo build: `pnpm run build`
- [ ] Run full monorepo test suite: `pnpm run test`
- [ ] Run smoke consumer test for all 11 new packages
- [ ] Verify all `package.json` files use semver (no `workspace:` deps in packed manifests)
- [ ] Update all `CHANGELOG.md` files for v1.0.0 entries
- [ ] Tag release: `git tag v1.0.0`
- [ ] Publish in order: wave 1 → wave 2 → wave 3 → wave 4 → update pre-release trio (drift/agent/canon)

---

## Reference

- **Package specs (source of truth)**: `ROADMAP.md` (project root)
- **Bloom Protocol**: `.admin/protocols/BLOOM-PROTOCOL.md`
- **Agent coordination**: `.admin/protocols/AGENT-COORDINATION.md`
- **Per-package prompts**: `.admin/build-plans/prompts/`
- **Audit protocol**: `.admin/audits/AUDIT-PROTOCOL.md`
- **Workstreams tracker**: `.admin/build-plans/WORKSTREAMS.md`

---

*Suttle Media LLC / UVRN-org | MIT License | Bloom Protocol v1.7*
