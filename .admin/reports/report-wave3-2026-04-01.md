# Wave 3 Build + Audit Report
**Date**: 2026-04-01
**Wave**: 3 — Aggregation & Analysis
**Packages**: `@uvrn/consensus`, `@uvrn/compare`, `@uvrn/identity`, `@uvrn/timeline`
**Build agent**: Codex
**Audit + remediation**: Claude (protocol/integration lead)

---

## Summary Table

| Package | Build | Tests | Audit Findings | Remediated | Status |
|---------|-------|-------|----------------|------------|--------|
| @uvrn/consensus | ✅ 0 errors | 6/6 | CONS-01 (major), CONS-02 (minor) | CONS-01 ✅ | Pass |
| @uvrn/compare | ✅ 0 errors | 6/6 | CMP-01 (minor, informational) | — | Pass |
| @uvrn/identity | ✅ 0 errors | 6/6 | IDN-01 (major), IDN-02 (minor), IDN-03 (minor) | IDN-01 ✅ | Pass |
| @uvrn/timeline | ✅ 0 errors | 7/7 | TML-01 (minor), TML-02 (minor) | TML-01 ✅, TML-02 ✅ | Pass |

**Total**: 25/25 tests green. 0 TypeScript errors. 2 major findings remediated. 2 minor fixes applied. 5 minor items remain open (non-blocking).

---

## Cross-Package Observations

- **No type redefinitions.** All four packages import upstream types from `@uvrn/core`, `@uvrn/drift`, `@uvrn/agent`, and `@uvrn/canon` correctly. No V-Score formula duplication.
- **Provider-agnostic interfaces verified.** `IdentityStore` and `TimelineStore` are clean contracts with in-memory mock implementations. Zero external services required.
- **No circular dependencies.** All cross-package links are peer deps. Dependency graph is acyclic.
- **`workspace:*` in devDependencies.** All four packages use `workspace:*` for `@uvrn/*` devDeps. pnpm publish will auto-convert these. Manual conversion needed if using npm publish directly. (META-01, non-blocking)

---

## Audit Findings Summary

### Closed (Remediated)

| ID | Severity | Package | Fix |
|----|----------|---------|-----|
| CONS-01 | Major | consensus | Added `@uvrn/agent` to peerDependencies + updated README |
| IDN-01 | Major | identity | Removed phantom `@uvrn/adapter` peer dep + DRVC3Receipt re-export |
| TML-01 | Minor | timeline | Removed double bucketing in chart path |
| TML-02 | Minor | timeline | Eliminated double fetch in apiUrl mode |

### Open (Non-Blocking)

| ID | Severity | Package | Notes |
|----|----------|---------|-------|
| CONS-02 | Minor | consensus | `#rankedSources()` caching — optimization only |
| IDN-02 | Minor | identity | Level gap for receipts >= 10, score < 60 — spec ambiguity |
| IDN-03 | Minor | identity | Float accumulation in accuracy tracking — low impact |
| CMP-01 | Minor | compare | Peer deps not imported — informational, follows build prompt |
| META-01 | Minor | all | `workspace:*` devDeps — pnpm publish handles conversion |

---

## Test Coverage Gaps (For Post-Audit Hardening)

- Consensus: missing tests for no-publishedAt fallback path, unit inference
- Compare: missing tests for >2 claims (should throw), single receipt in series
- Identity: missing tests for getOrCreate on new address, concurrent record(), level=unknown
- Timeline: missing tests for hourly/weekly resolution, apiUrl mode (mocked fetch)

---

## Recommendation

**Wave 3 is complete and audited. Ready for Wave 4 kickoff.**

No critical or major findings remain open. All four packages build, test, and conform to the protocol spec. The five open minor items are non-blocking and can be addressed in a future hardening pass.

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
