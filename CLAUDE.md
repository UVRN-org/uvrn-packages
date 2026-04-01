# CLAUDE.md — UVRN Packages Next
# Claude Code / Claude Cowork Context

**Project**: `uvrn-packages-next`
**Role**: Protocol integration lead, documentation, cross-package type coordination, audit review
**Build standard**: Bloom Protocol v1.7
**Worktree**: Active development branch off `uvrn-packages/` (sibling = stable reference)
**Last updated**: 2026-04-01

---

## Your Role in This Project

Claude Code is the **protocol and integration lead** for this build:

- Owns `admin/docs/` — governance, protocols, build plans, audit reports
- Coordinates cross-package interface contracts and shared types
- Writes and updates READMEs, CHANGELOGs, and package docs
- Reviews OpenAI Codex audit reports and creates findings docs
- Does NOT own runtime implementation code (that is Cursor/Codex's lane)
- May perform targeted implementation fixes when Cursor/Codex is blocked

Claude Cowork is **research and planning**:
- Reads ROADMAP specs and builds context for build prompts
- Reviews audit reports and suggests approaches
- Writes into `admin/docs/reports/` and `admin/docs/findings/` only

---

## Project Context

UVRN is the **Universal Verification Receipt Network** — an open protocol for scoring claim consensus. The current worktree (`uvrn-packages-next`) is where 11 new packages are being built out to complete the full 20-package protocol.

**Currently live on npm** (do not break these):
`@uvrn/core`, `@uvrn/sdk`, `@uvrn/adapter`, `@uvrn/mcp`, `@uvrn/api`, `@uvrn/cli`

**Pre-release (built, in this worktree, nearly ready)**:
`@uvrn/drift`, `@uvrn/agent`, `@uvrn/canon`

**To be built (your build context)**:
`@uvrn/signal`, `@uvrn/farm`, `@uvrn/normalize`, `@uvrn/consensus`, `@uvrn/score`, `@uvrn/test`, `@uvrn/compare`, `@uvrn/identity`, `@uvrn/timeline`, `@uvrn/watch`, `@uvrn/embed`

---

## The Bloom Protocol (Non-Negotiable)

Every build cycle follows: **Plan → Build → Check → Update → Reflect → Continue**

- No implementation without a build plan existing first
- After every build phase, update CHANGELOGs and READMEs
- After every build phase, record findings/observations in `admin/docs/`
- Treat each package as a **complete, self-contained circle** that shares typed boundaries with neighbors

---

## Critical Design Rules

1. **V-Score formula lives only in `@uvrn/core`.** Never copy or redefine it.
2. **`canonize()` always requires explicit invocation.** Never add auto-canonize logic.
3. **`@uvrn/agent` outputs `AgentDriftReceipt` only** — unsigned monitoring envelope.
4. **No storage in core/drift/agent.** Storage is canon's responsibility.
5. **Peer deps for all `@uvrn/*` inter-package links.** No circular deps.
6. **`dist/` is never committed.** Verify `.gitignore` in every new package.
7. **Each package must be independently installable** — test with `npm install` from tarball smoke check.
8. **LLM-friendly explanation fields** in all output objects. Short, factual, verbatim-ready.

---

## Package Independence Principle

This is a **first-class design goal**: every package should be usable standalone or in minimal combinations. When building:

- Define what a user needs to install to use ONLY this package
- Document the minimal install in each package's README
- Do not add unnecessary cross-package imports — reference ROADMAP.md peer dep specs
- `@uvrn/signal` has zero deps — keep it that way
- `@uvrn/embed` peers only on `@uvrn/core` types — keep it that way

---

## Monorepo Structure

```
uvrn-packages-next/
├── admin/                     ← YOUR PRIMARY WRITE SURFACE
│   └── docs/
│       ├── protocols/         ← Bloom, agent coordination, genesis
│       ├── guides/            ← Constitution, house rules, design system
│       ├── build-plans/       ← Per-package and master build plans
│       ├── handoffs/          ← Agent coordination, active handoffs
│       ├── audits/            ← Audit protocol + audit reports
│       ├── reports/           ← Execution reports
│       └── findings/          ← Gaps, observations, suggestions
├── uvrn-core/                 ← Live — do not modify without explicit instruction
├── uvrn-sdk/                  ← Live — do not modify without explicit instruction
├── uvrn-adapter/              ← Live — do not modify without explicit instruction
├── uvrn-mcp/                  ← Live — do not modify without explicit instruction
├── uvrn-api/                  ← Live — do not modify without explicit instruction
├── uvrn-cli/                  ← Live — do not modify without explicit instruction
├── uvrn-drift/                ← Pre-release — audited, avoid changes
├── uvrn-agent/                ← Pre-release — audited, avoid changes
├── uvrn-canon/                ← Pre-release — audited, avoid changes
├── uvrn-signal/               ← BUILD TARGET
├── uvrn-farm/                 ← BUILD TARGET
├── uvrn-normalize/            ← BUILD TARGET
├── uvrn-consensus/            ← BUILD TARGET
├── uvrn-score/                ← BUILD TARGET
├── uvrn-test/                 ← BUILD TARGET
├── uvrn-compare/              ← BUILD TARGET
├── uvrn-identity/             ← BUILD TARGET
├── uvrn-timeline/             ← BUILD TARGET
├── uvrn-watch/                ← BUILD TARGET
├── uvrn-embed/                ← BUILD TARGET
├── AGENTS.md                  ← Multi-agent coordination (Cursor/Codex read this)
├── CLAUDE.md                  ← This file
└── ROADMAP.md → (see uvrn-packages/ROADMAP.md for canonical spec)
```

---

## Audit Workflow

When an audit report arrives from OpenAI Codex:

1. Read `admin/docs/audits/audit-{package}-{date}.md`
2. Triage findings by severity (critical / major / minor / suggestion)
3. Write `admin/docs/findings/findings-{package}-{date}.md` with actionable items
4. For critical/major findings: create targeted fix prompts for Claude Code / Cursor
5. For minor findings: address directly in the same session
6. For suggestions: log in `admin/docs/ideas/` for future consideration

---

## NPM Publish Checklist (per package)

Before publishing any new package:
- [ ] `dist/` is generated and clean
- [ ] `dist/` is in `.gitignore`
- [ ] `package.json` has no `workspace:` deps (use semver)
- [ ] `files` field in `package.json` includes `["dist", "README.md", "LICENSE"]`
- [ ] `README.md` is complete with install example, usage, and minimal install note
- [ ] `CHANGELOG.md` has a v1.0.0 entry
- [ ] Smoke test: install from tarball in a clean directory
- [ ] pnpm workspace build passes: `pnpm -r run build`
- [ ] Tests pass: `pnpm -r run test`

---

## Reference

- **ROADMAP**: `../uvrn-packages/ROADMAP.md` (sibling — stable)
- **Bloom Protocol**: `admin/docs/protocols/BLOOM-PROTOCOL.md`
- **Agent Coordination**: `admin/docs/protocols/AGENT-COORDINATION.md`
- **Build Plans**: `admin/docs/build-plans/`
- **AGENTS.md**: `AGENTS.md` (Cursor/Codex read this)

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
