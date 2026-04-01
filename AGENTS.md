# AGENTS.md — UVRN Packages Next
# Multi-Agent Build Context for Cursor / OpenAI Codex / Claude Code

**Project**: `uvrn-packages-next`
**Monorepo**: UVRN (Universal Verification Receipt Network) — full 20-package protocol
**Active branch**: `feature/updates` (git worktree from `uvrn-packages/`)
**Build standard**: Bloom Protocol v1.7 — `admin/docs/protocols/BLOOM-PROTOCOL.md`
**Last updated**: 2026-04-01

---

## What This Repo Is

This is the **active development worktree** for expanding the UVRN protocol from 9 published packages to a full 20-package open protocol. The `uvrn-packages/` directory (sibling) is the preserved stable reference.

UVRN is a **Universal Verification Receipt Network** — an open protocol for scoring claim consensus using structured data bundles, the V-Score formula, and signed DRVC3 receipts.

**V-Score formula (canonical, defined in `@uvrn/core`, never redefined):**
```
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

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

## Package Status

| Package | Layer | Status | Priority |
|---------|-------|--------|----------|
| `@uvrn/core` | 2 | ✅ Live (npm) | — |
| `@uvrn/sdk` | 2 | ✅ Live (npm) | — |
| `@uvrn/adapter` | 2 | ✅ Live (npm) | — |
| `@uvrn/mcp` | 4 | ✅ Live (npm) | — |
| `@uvrn/api` | 4 | ✅ Live (npm) | — |
| `@uvrn/cli` | 4 | ✅ Live (npm) | — |
| `@uvrn/drift` | 3 | ✅ Pre-release (built, audited) | — |
| `@uvrn/agent` | 3 | ✅ Pre-release (built, audited) | — |
| `@uvrn/canon` | 3 | ✅ Pre-release (built, audited) | — |
| `@uvrn/signal` | 1 | 🔨 **BUILD** | P1 — zero deps, unblocks all |
| `@uvrn/farm` | 1 | 🔨 **BUILD** | P1 — missing input layer |
| `@uvrn/normalize` | 1 | 🔨 **BUILD** | P2 — depends on farm |
| `@uvrn/consensus` | 1 | 🔨 **BUILD** | P2 — depends on farm, normalize |
| `@uvrn/score` | 2 | 🔨 **BUILD** | P2 — depends on core only |
| `@uvrn/test` | 2 | 🔨 **BUILD** | P2 — devDep utility |
| `@uvrn/compare` | 2 | 🔨 **BUILD** | P3 — depends on core, drift |
| `@uvrn/identity` | 2 | 🔨 **BUILD** | P3 — depends on core, adapter |
| `@uvrn/timeline` | 3 | 🔨 **BUILD** | P3 — depends on core, drift, canon |
| `@uvrn/watch` | 4 | 🔨 **BUILD** | P3 — depends on agent, drift |
| `@uvrn/embed` | 4 | 🔨 **BUILD** | P4 — React + UMD bundle |

---

## Dependency Graph (Build Order)

```
@uvrn/signal   ← zero deps — build first
@uvrn/score    ← peer: core — build alongside signal
@uvrn/farm     ← peer: core, implements agent.FarmConnector
@uvrn/test     ← peer: core, drift, canon (devDeps only)
@uvrn/normalize ← deps: core, farm (optional)
@uvrn/consensus ← deps: core, farm (optional)
@uvrn/compare  ← deps: core, drift
@uvrn/identity ← deps: core, adapter
@uvrn/timeline ← deps: core, drift, canon
@uvrn/watch    ← deps: agent, drift
@uvrn/embed    ← peer: core types only
```

---

## Agent Role Assignments

| Agent | Role | Writes To | Do NOT Touch |
|-------|------|-----------|--------------|
| **Cursor / Codex** | Primary build agent | Assigned package `src/`, `tests/` | `admin/docs/`, `AGENTS.md`, `CLAUDE.md` |
| **Claude Code** | Protocol + integration lead | `admin/docs/`, cross-package types, README files | Do not modify shared `@uvrn/core` types without explicit instruction |
| **Claude Cowork** | Research, planning, audit review | `admin/docs/reports/`, `admin/docs/findings/` | No runtime code |
| **OpenAI Codex** | Audit engine | `admin/docs/audits/` (report outputs only) | No runtime code modifications |

---

## Critical Design Rules (Non-Negotiable)

1. **Never redefine V-Score weights.** They live in `@uvrn/core` only.
2. **`canonize()` must always require explicit human/system invocation.** Never auto-canonize.
3. **`@uvrn/agent` emits `AgentDriftReceipt` only** — not signed DRVC3. Signing is `@uvrn/canon`'s job.
4. **Decay only affects Freshness.** Completeness and Parity are re-scored when new sources arrive.
5. **No storage in `@uvrn/core`, `@uvrn/drift`, or `@uvrn/agent`.** Storage belongs to `@uvrn/canon`.
6. **No circular dependencies** between packages. Use peer deps for `@uvrn/*` inter-package links.
7. **Protocol-first.** Define types before implementation. All types through `src/types/index.ts`.
8. **LLM-friendly output fields.** `explanation`, `summary`, `breakdown` strings should be verbatim-ready for LLM responses.
9. **`dist/` is never committed.** Always in `.gitignore`.
10. **Packages must be independently installable** — a user installing only `@uvrn/farm` + `@uvrn/core` should not be forced to pull the entire protocol.

---

## Package Structure Convention

Every package follows this exact layout:

```
uvrn-{name}/
├── src/
│   ├── index.ts          # single public entry point — all exports here
│   ├── types/
│   │   └── index.ts      # all types exported from here
│   └── [modules]/        # implementation files
├── tests/
│   └── {name}.test.ts
├── dist/                  # generated — NEVER committed
├── package.json
├── tsconfig.json
├── jest.config.js
├── CHANGELOG.md
├── README.md
└── LICENSE
```

---

## TypeScript Standards

- `strict: true` in all `tsconfig.json` files
- No `any` without justifying comment
- No `@ts-ignore` without ADR
- All public exports must have explicit types
- Peer deps for `@uvrn/*` packages — never `dependencies`
- `@uvrn/test` is always a `devDependency`, never runtime

---

## Build Commands

```bash
# Install all workspaces
pnpm install

# Build all packages
pnpm run build

# Test all packages
pnpm run test

# Build a single package
cd uvrn-{name} && pnpm run build

# Test a single package
cd uvrn-{name} && pnpm run test
```

---

## Audit Protocol

After each package build reaches a stable state, an audit pass is scheduled:

1. **Agent writes code** → Cursor/Claude Code build pass
2. **Audit trigger** → OpenAI Codex reviews the package against ROADMAP spec + house rules
3. **Audit report** → saved to `admin/docs/audits/audit-{package}-{date}.md`
4. **Findings review** → Claude Cowork / Claude Code address findings
5. **Findings doc** → saved to `admin/docs/findings/findings-{package}-{date}.md`

See: `admin/docs/audits/AUDIT-PROTOCOL.md` for the full audit checklist.

---

## NPM Publish Order (Full 20-Package Sequence)

```
1.  @uvrn/core
2.  @uvrn/drift
3.  @uvrn/sdk
4.  @uvrn/adapter
5.  @uvrn/canon
6.  @uvrn/agent
7.  @uvrn/farm
8.  @uvrn/normalize
9.  @uvrn/consensus
10. @uvrn/signal
11. @uvrn/score
12. @uvrn/compare
13. @uvrn/identity
14. @uvrn/test
15. @uvrn/timeline
16. @uvrn/mcp
17. @uvrn/api
18. @uvrn/cli
19. @uvrn/watch
20. @uvrn/embed
```

---

## Reference Docs

- **Full package specs**: `uvrn-packages/ROADMAP.md` (sibling repo — stable reference)
- **Bloom Protocol**: `admin/docs/protocols/BLOOM-PROTOCOL.md`
- **Agent Coordination**: `admin/docs/protocols/AGENT-COORDINATION.md`
- **Build Plans**: `admin/docs/build-plans/`
- **Audit Protocol**: `admin/docs/audits/AUDIT-PROTOCOL.md`

---

*UVRN — Universal Verification Receipt Network | MIT License | UVRN-org*
