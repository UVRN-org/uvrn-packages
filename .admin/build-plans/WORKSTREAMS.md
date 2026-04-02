# UVRN Packages Next — Workstreams Tracker

**Project**: `uvrn-packages-next`
**Protocol**: Bloom Protocol v1.7
**Last Updated**: 2026-04-02 (Wave 4 built, audited, and remediated)
**Integration Owner**: Claude Code

---

## Active Status Overview

| Wave | Packages | Build Status | Audit Status | Publish Ready |
|------|----------|--------------|--------------|---------------|
| Pre-release | drift, agent, canon | ✅ Built | ✅ Audited | 🔜 Pending wave-1 |
| Wave 1 | signal, score, test | ✅ Built | ✅ Audited | ⬜ |
| Wave 2 | farm, normalize | ✅ Built | ✅ Audited | ⬜ |
| Wave 3 | consensus, compare, identity, timeline | ✅ Built | ✅ Audited + remediated | ⬜ |
| Wave 4 | watch, embed | ✅ Built | ✅ Audited + remediated | ⬜ |

---

## Wave 1 — Zero-Dep Foundations

**Status**: ✅ Built
**Target**: Build all 3, pass tests, pass audit before Wave 2

### @uvrn/signal

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Cursor / Claude Code | ✅ | See `BUILD-signal.md` |
| Test | Cursor / Claude Code | ✅ | `pnpm run test` |
| Audit | Claude Code | ✅ | findings-wave1-2026-04-01.md |
| Findings Review | Claude Code | ✅ | SIGNAL-01 (minor), SIGNAL-02 (suggestion) |
| README | Claude Code | ✅ | |
| CHANGELOG | Claude Code | ✅ | |

### @uvrn/score

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Cursor / Claude Code | ✅ | See `BUILD-score.md` |
| Test | Cursor / Claude Code | ✅ | |
| Audit | Claude Code | ✅ | findings-wave1-2026-04-01.md |
| Findings Review | Claude Code | ✅ | SCORE-01 (minor), SCORE-02 (suggestion); WEIGHTS fallback approved |
| README | Claude Code | ✅ | |

### @uvrn/test

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Cursor / Claude Code | ✅ | See `BUILD-test.md` |
| Test | Cursor / Claude Code | ✅ | |
| Audit | Claude Code | ✅ | findings-wave1-2026-04-01.md |
| Findings Review | Claude Code | ✅ | TEST-01 (minor), TEST-03 (suggestion) |
| README | Claude Code | ✅ | |

**Wave 1 Audit Checkpoint**: → `admin/docs/audits/audit-wave1-{date}.md`

---

## Wave 2 — Data Ingestion Layer

**Status**: ✅ Built + audited
**Dependency**: ✅ Wave 1 complete + audited

### @uvrn/farm

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Cursor / Claude Code | ✅ | See `BUILD-farm.md`; scaffolded and verified 2026-04-01 |
| Test | Cursor / Claude Code | ✅ | 9/9 tests pass |
| Audit | Claude Code | ✅ | `audit-wave2-2026-04-01.md`; FARM-05 remediation applied + re-audited clean |
| Findings Review | Claude Code | ✅ | FARM-02 (minor, non-blocking); FARM-05 (remediated); FARM-06 (minor, open) |

### @uvrn/normalize

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Cursor / Claude Code | ✅ | See `BUILD-normalize.md`; heuristic transformer matching locked in 2026-04-01 |
| Test | Cursor / Claude Code | ✅ | 7/7 tests pass |
| Audit | Claude Code | ✅ | `audit-wave2-2026-04-01.md`; no critical/major findings |
| Findings Review | Claude Code | ✅ | FARM-02 shared finding logged; heuristic matching accepted for v1 |

**Wave 2 Audit Checkpoint**: ✅ `audit-wave2-2026-04-01.md` — PASS

**Open minor items (non-blocking for Wave 3):**
- FARM-02: `NormalizationProfiles` typed as `Record<string,…>` — `keyof typeof` narrowing is nominal only. Non-blocking; address in v1.1 if desired.
- FARM-06: `MultiFarm` eagerly calls `connector.fetch()` inside `.map()` before `runWithTimeout`. Non-blocking; can be deferred.

---

## Wave 3 — Aggregation & Analysis

**Status**: ✅ Built + audited + remediated
**Dependency**: ✅ Wave 2 complete + audited

### @uvrn/consensus

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Codex | ✅ | 6/6 tests pass |
| Audit | Claude Code | ✅ | CONS-01 (major) remediated: `@uvrn/agent` added to peerDeps |
| Findings | Claude Code | ✅ | CONS-02 (minor, open): `#rankedSources()` caching |

### @uvrn/compare

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Codex | ✅ | 6/6 tests pass |
| Audit | Claude Code | ✅ | CMP-01 (minor, informational): peer deps not imported |
| Findings | Claude Code | ✅ | No actionable items |

### @uvrn/identity

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Codex | ✅ | 6/6 tests pass |
| Audit | Claude Code | ✅ | IDN-01 (major) remediated: phantom `@uvrn/adapter` removed |
| Findings | Claude Code | ✅ | IDN-02 (spec gap), IDN-03 (float accumulation) — both minor, open |

### @uvrn/timeline

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Codex | ✅ | 7/7 tests pass |
| Audit | Claude Code | ✅ | TML-01 + TML-02 remediated (double bucket + double fetch) |
| Findings | Claude Code | ✅ | No remaining actionable items |

**Wave 3 Audit Checkpoint**: ✅ `audit-wave3-2026-04-01.md` — PASS (2 majors remediated, 5 minors open non-blocking)

---

## Wave 4 — Distribution & Access

**Status**: ✅ Built + audited + remediated as of 2026-04-02
**Dependency**: All prior waves complete + audited

### @uvrn/watch

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Codex | ✅ | See `BUILD-watch.md`; built 2026-04-02 |
| Test | Codex | ✅ | 10/10 tests pass |
| Audit | Claude / Codex | ✅ | Wave 4 audit completed 2026-04-02; non-blocking notes accepted |

### @uvrn/embed

| Phase | Agent | Status | Notes |
|-------|-------|--------|-------|
| Build | Codex | ✅ | See `BUILD-embed.md`; React + UMD build complete 2026-04-02 |
| Test | Codex | ✅ | 8/8 tests pass |
| Audit | Claude / Codex | ✅ | `EMB-01` phantom `@uvrn/core` dependency remediated 2026-04-02 |

**Wave 4 Audit Checkpoint**: ✅ `audit-wave4-2026-04-02.md` — major finding remediated; remaining notes non-blocking

---

## Final Pre-Publish Checklist

- [ ] All 11 packages pass `pnpm run build`
- [ ] All 11 packages pass `pnpm run test`
- [ ] Final full-suite audit passes (0 CRITICAL, 0 MAJOR findings)
- [ ] Root `README.md` updated (all 20 packages listed)
- [ ] Root `pnpm-workspace.yaml` updated (all 11 new packages added)
- [ ] All `CHANGELOG.md` files have v1.0.0 entries
- [ ] All `package.json` use semver (no `workspace:` in packed manifests)
- [ ] Smoke consumer test passes for all 11 packages
- [ ] Pre-release trio (drift, agent, canon) publish pass
- [ ] Release tagged: `v2.0.0-next`

---

## Checkpoints Log

| # | Description | Date | SHA | Status |
|---|-------------|------|-----|--------|
| 0 | Project scaffolded, admin section created | 2026-04-01 | — | ✅ |
| 1 | Wave 1 complete + audited | 2026-04-01 | — | ✅ |
| 2 | Wave 2 complete + audited | 2026-04-01 | — | ✅ |
| 3 | Wave 3 complete + audited + remediated | 2026-04-01 | — | ✅ |
| 4 | Wave 4 complete + audited | 2026-04-02 | — | ✅ |
| 5 | Final audit + publish ready | — | — | ⬜ |

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
