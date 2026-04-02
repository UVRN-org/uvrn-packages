# uvrn-packages-next

Full 20-package open protocol for the **UVRN** (Universal Verification Receipt Network).

All packages are built, tested, and audited. The 11 new packages are at v2.0.0, ready for npm publish.

**Build standard**: Bloom Protocol v1.7 → `.admin/protocols/BLOOM-PROTOCOL.md`
**Agent context**: `AGENTS.md` (Cursor/Codex) | `CLAUDE.md` (Claude Code)
**Build plans**: `.admin/build-plans/`

---

## What is UVRN?

UVRN is an **open protocol for scoring claim consensus** — a way to measure how much independent evidence agrees on a claim and how that agreement evolves over time.

It is built as a set of modular, independently installable packages. You pick the pieces you need. You bring your own data sources, storage backends, and delivery targets. The protocol handles the math, the lifecycle, and the interface contracts.

**V-Score formula** (defined once, in `@uvrn/core`, never redefined):
```
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

---

## Design Philosophy

UVRN is **provider-agnostic by design**. Every package in this protocol is built around its *interface contract*, not around any specific third-party service or technology stack.

- Packages that touch external systems define a **pluggable interface** — you implement it with whatever provider you use
- **Reference implementations** using free/open APIs are included as working examples — not locked-in defaults
- **The in-process / zero-external path always works** — you can run the full protocol locally with no external service signups
- **Interfaces are the protocol; implementations are examples** — clearly documented so you know what to own and what to swap

This is what makes UVRN usable across any stack: a DeFi monitor, a newsroom fact-checker, a research integrity tool, a custom enterprise data pipeline — all built on the same protocol, all bringing their own providers.

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
| `@uvrn/drift` | 3 | ✅ Built + audited | Temporal decay scoring |
| `@uvrn/agent` | 3 | ✅ Built + audited | Continuous claim monitoring loop |
| `@uvrn/canon` | 3 | ✅ Built + audited | Canonization engine — permanent signed records |
| `@uvrn/signal` | 1 | ✅ Built + audited | Typed internal event bus — zero deps |
| `@uvrn/score` | 2 | ✅ Built + audited | V-Score breakdown + domain profiles |
| `@uvrn/test` | 2 | ✅ Built + audited | Mocks, fixtures, factory functions |
| `@uvrn/farm` | 1 | ✅ Built + audited | Data source connectors (news, financial, on-chain) |
| `@uvrn/normalize` | 1 | ✅ Built + audited | Source normalization layer |
| `@uvrn/consensus` | 1 | ✅ Built + audited | Multi-source signal aggregation |
| `@uvrn/compare` | 2 | ✅ Built + audited | Cross-receipt comparison |
| `@uvrn/identity` | 2 | ✅ Built + audited | Signer reputation layer |
| `@uvrn/timeline` | 3 | ✅ Built + audited | Time-series query layer |
| `@uvrn/watch` | 4 | ✅ Built + audited | Subscription & threshold alerts |
| `@uvrn/embed` | 4 | ✅ Built + audited | Embeddable React badge + UMD script |

---

## Release Status

All 20 packages are built and audited. The 11 new packages (waves 1–4) are at v2.0.0, ready for npm publish.

| Wave | Packages | Status |
|------|----------|--------|
| Wave 1 | `@uvrn/signal`, `@uvrn/score`, `@uvrn/test` | ✅ Built + audited |
| Wave 2 | `@uvrn/farm`, `@uvrn/normalize` | ✅ Built + audited |
| Wave 3 | `@uvrn/consensus`, `@uvrn/compare`, `@uvrn/identity`, `@uvrn/timeline` | ✅ Built + audited |
| Wave 4 | `@uvrn/watch`, `@uvrn/embed` | ✅ Built + audited |

See `.admin/build-plans/MASTER-BUILD-PLAN.md` for full build plan details.

---

## Package Independence

Every package is **independently installable**. You do not need the full protocol to use a single package. Each README documents the minimum install required.

Packages that touch external systems expose pluggable interfaces — bring your own provider:

| Package | Pluggable Interface | What you bring |
|---------|--------------------|----|
| `@uvrn/farm` | `FarmConnector` | Any data source — API, feed, scraper, custom |
| `@uvrn/canon` | `CanonStore` | Any storage backend — SQL, KV, IPFS, cloud |
| `@uvrn/identity` | `IdentityStore` | Any storage backend |
| `@uvrn/timeline` | `TimelineStore` | Any storage backend |
| `@uvrn/watch` | `NotifyTarget` | Any delivery channel — webhook, callback, custom |
| `@uvrn/embed` | `apiUrl` config | Any UVRN-compatible API endpoint |

Reference implementations for common providers are included in each package as working examples.

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
├── uvrn-signal/   uvrn-score/ uvrn-test/     ← Wave 1 ✅
├── uvrn-farm/     uvrn-normalize/            ← Wave 2 ✅
├── uvrn-consensus/ uvrn-compare/ uvrn-identity/ ← Wave 3 ✅
└── uvrn-timeline/ uvrn-watch/ uvrn-embed/    ← Wave 4 ✅
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

- **Full package specs**: `ROADMAP.md` (canonical spec — interface contracts and design notes for all 20 packages)
- **Build plans**: `.admin/build-plans/`
- **Audit protocol**: `.admin/audits/AUDIT-PROTOCOL.md`
- **Design philosophy**: See "Provider-Agnostic by Design" section in `ROADMAP.md` and `AGENTS.md`

## Open Source

Source code and issues: [uvrn-packages](https://github.com/UVRN-org/uvrn-packages) · MIT License · UVRN-org

**Disclaimer:** UVRN is in Alpha. The protocol measures whether your sources agree with each other — not whether they're correct. Final trust of any output rests with the user.

## License

MIT — UVRN-org
