# uvrn-packages-next

Active development worktree for the **UVRN** (Universal Verification Receipt Network) full 20-package protocol.

**This is the active build branch.** The sibling directory `uvrn-packages/` is the stable reference (live npm packages).

**Build standard**: Bloom Protocol v1.7 → `admin/docs/protocols/BLOOM-PROTOCOL.md`
**Agent context**: `AGENTS.md` (Cursor/Codex) | `CLAUDE.md` (Claude Code)
**Build plans**: `admin/docs/build-plans/`

---

## Protocol Overview

UVRN is an open protocol for scoring claim consensus using the **V-Score formula**:

```
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

This formula is defined once, in `@uvrn/core`, and referenced everywhere else. Never redefined.

---

## Protocol Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4 — Distribution & Access                                │
│  @uvrn/embed  @uvrn/watch  @uvrn/mcp  @uvrn/api  @uvrn/cli    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — Temporal & Lifecycle                                 │
│  @uvrn/drift  @uvrn/agent  @uvrn/canon  @uvrn/timeline         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — Receipt & Verification                               │
│  @uvrn/core  @uvrn/sdk  @uvrn/adapter  @uvrn/score             │
│  @uvrn/compare  @uvrn/identity  @uvrn/test                     │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1 — Data & Consensus                                     │
│  @uvrn/farm  @uvrn/consensus  @uvrn/normalize  @uvrn/signal    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Full Package Status

| Package | Layer | Status | Description |
|---------|-------|--------|-------------|
| `@uvrn/core` | 2 | ✅ Live | Delta engine — V-Score math, validation, DRVC3 receipts |
| `@uvrn/sdk` | 2 | ✅ Live | TypeScript SDK — submit claims, read receipts |
| `@uvrn/adapter` | 2 | ✅ Live | DRVC3 envelope adapter — EIP-191 signatures |
| `@uvrn/mcp` | 4 | ✅ Live | MCP server — AI agent native access |
| `@uvrn/api` | 4 | ✅ Live | Fastify REST API — self-hosted deployments |
| `@uvrn/cli` | 4 | ✅ Live | CLI — `uvrn run bundle.json` → receipt |
| `@uvrn/drift` | 3 | 🔜 Pre-release | Temporal decay scoring |
| `@uvrn/agent` | 3 | 🔜 Pre-release | Continuous claim monitoring loop |
| `@uvrn/canon` | 3 | 🔜 Pre-release | Canonization engine — permanent signed records |
| `@uvrn/signal` | 1 | 🔨 Building | Typed internal event bus — zero deps |
| `@uvrn/score` | 2 | 🔨 Building | V-Score breakdown + domain profiles |
| `@uvrn/test` | 2 | 🔨 Building | Mocks, fixtures, factory functions |
| `@uvrn/farm` | 1 | 🔨 Building | Data source connectors (news, financial, on-chain) |
| `@uvrn/normalize` | 1 | 🔨 Building | Source normalization layer |
| `@uvrn/consensus` | 1 | 🔨 Building | Multi-source signal aggregation |
| `@uvrn/compare` | 2 | 🔨 Building | Cross-receipt comparison |
| `@uvrn/identity` | 2 | 🔨 Building | Signer reputation layer |
| `@uvrn/timeline` | 3 | 🔨 Building | Time-series query layer |
| `@uvrn/watch` | 4 | 🔨 Building | Subscription & threshold alerts |
| `@uvrn/embed` | 4 | 🔨 Building | Embeddable React badge + UMD script |

---

## Build Waves

Packages are built in dependency order. See `admin/docs/build-plans/MASTER-BUILD-PLAN.md` for full details.

**Wave 1** (parallel): `@uvrn/signal`, `@uvrn/score`, `@uvrn/test`
**Wave 2** (parallel): `@uvrn/farm`, `@uvrn/normalize`
**Wave 3** (parallel): `@uvrn/consensus`, `@uvrn/compare`, `@uvrn/identity`
**Wave 4** (parallel): `@uvrn/timeline`, `@uvrn/watch`, `@uvrn/embed`

Each wave is audited by OpenAI Codex before the next wave begins.

---

## Package Independence

Every package is **independently installable**. You do not need the full protocol to use a single package. Each README documents the minimum install required.

---

## Install & Build

```bash
pnpm install
pnpm run build
pnpm run test
```

---

## Structure

```
uvrn-packages-next/
├── admin/
│   └── docs/
│       ├── protocols/         ← Bloom Protocol, Agent Coordination
│       ├── build-plans/       ← Master build plan, per-package prompts
│       ├── audits/            ← Audit protocol + reports
│       ├── handoffs/          ← Active coordination docs
│       ├── reports/           ← Execution reports
│       └── findings/          ← Audit findings and observations
├── AGENTS.md                  ← Cursor/Codex agent context (read this)
├── CLAUDE.md                  ← Claude Code context (read this)
├── uvrn-core/     uvrn-sdk/   uvrn-adapter/
├── uvrn-mcp/      uvrn-api/   uvrn-cli/
├── uvrn-drift/    uvrn-agent/ uvrn-canon/
├── uvrn-signal/   uvrn-score/ uvrn-test/     ← Wave 1
├── uvrn-farm/     uvrn-normalize/            ← Wave 2
├── uvrn-consensus/ uvrn-compare/ uvrn-identity/ ← Wave 3
└── uvrn-timeline/ uvrn-watch/ uvrn-embed/    ← Wave 4
```

---

## Publish Order

```
1. @uvrn/core → 2. @uvrn/drift → 3. @uvrn/sdk → 4. @uvrn/adapter
→ 5. @uvrn/canon → 6. @uvrn/agent → 7. @uvrn/farm → 8. @uvrn/normalize
→ 9. @uvrn/consensus → 10. @uvrn/signal → 11. @uvrn/score → 12. @uvrn/compare
→ 13. @uvrn/identity → 14. @uvrn/test → 15. @uvrn/timeline
→ 16. @uvrn/mcp → 17. @uvrn/api → 18. @uvrn/cli → 19. @uvrn/watch → 20. @uvrn/embed
```

---

## Reference

- **Full package specs**: `../uvrn-packages/ROADMAP.md` (stable reference)
- **Build plans**: `admin/docs/build-plans/`
- **Audit protocol**: `admin/docs/audits/AUDIT-PROTOCOL.md`

## License

MIT — UVRN-org
