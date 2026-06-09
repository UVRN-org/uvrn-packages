# Audit: PR #4 delta_score_claim — Round 2 Re-Audit

Repo: UVRN-org/uvrn-packages_builds_private_1  
PR: #4, branch `feat/score-claim-enrichment` → base `feat/trend-engine-layer-v1`  
Package: `@uvrn/mcp` v1.2.0 (+ `@uvrn/agent`, `@uvrn/consensus`, `@uvrn/normalize`, `@uvrn/core`, `@uvrn/score`)  
Date: 2026-06-08  
Auditor: Cursor (re-audit agent, Round 2)  
Prior audit: [audit-mcp-2026-06-08.md](./audit-mcp-2026-06-08.md) (NO-GO)  
Remediation log: [report-pr4-remediation-worklog-2026-06-08.md](../reports/report-pr4-remediation-worklog-2026-06-08.md)

## Verdict

**GO** — All Round-1 findings are resolved in the remediation working tree. Build, tests, split-brain probe, and adversarial checks pass. Safe to merge after committing the 13 uncommitted runtime files.

---

## Audit scope

**Worktree audited:** `uvrn-packages_LIVE-BUILDS-PRIVATE_score-claim-enrichment-pr4`

**Important:** Remediation exists in the **working tree only** (not yet committed to `feat/score-claim-enrichment` HEAD). Committed HEAD still contains the Round-1 snippet-prefix bug. This audit verified the uncommitted remediation as specified.

**Scope confirmation (`git diff --stat`):** 13 files, +325 / −16 — matches remediation scope exactly.

```
 uvrn-agent/src/types/index.ts
 uvrn-consensus/src/engine/aggregation.ts + tests/consensus.test.ts
 uvrn-core/src/types/index.{ts,js,d.ts}
 uvrn-mcp/src/tools/handlers.ts, schemas.ts, types.ts + handlers.test.ts
 uvrn-normalize/src/normalize/transformers/general.ts + tests/normalize.test.ts
 uvrn-score/src/types/index.ts
```

---

## Round-1 finding resolution

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| **MAJOR-1** | `evidenceScore` smuggled via snippet prefix; title numbers win | **RESOLVED** | `FarmSource.evidenceScore?: number` added in `uvrn-agent/src/types/index.ts:54`. Handler maps field directly (`handlers.ts:440`); snippet prefix removed. `extractMetricValue()` (`aggregation.ts:57-62`) and `generalProfile` (`general.ts:18-21`) prefer finite `evidenceScore` before regex. Split-brain probe: normalized values `[80, 60]` not `[10, 99]`. |
| **MAJOR-2** | `@uvrn/score` redefines V-Score weights locally | **RESOLVED** | `VSCORE_WEIGHTS` canonical in `uvrn-core/src/types/index.ts:71-75` (`{0.35, 0.35, 0.3}`). `@uvrn/score` re-exports as `WEIGHTS = VSCORE_WEIGHTS`. `@uvrn/drift` still imports `WEIGHTS` from `@uvrn/score`. Weights byte-identical; fixed-input score regression unchanged (final 85.5). |
| **MINOR-1** | Exactly one host source silently falls through to connector/mock | **RESOLVED** | `handlers.ts:416-418` throws `ValidationError('Host evidence requires at least 2 sources')`. Adversarial probe confirms `VALIDATION_ERROR`. |
| **MINOR-2** | `sourceCount` reports raw merged count | **RESOLVED** | `handlers.ts:520` sets `sourceCount: consensus.stats.sourceCount`. Tests cover non-numeric drop (3→2) and dedupe (3→2). |
| **MINOR-3** | Derived `claimId` collision-prone slug only | **RESOLVED** | `handlers.ts:573-575` appends 8-char SHA-256 hash: `${slug}-${hash}`. Test asserts `/^cottagecore-prints-are-trending-[0-9a-f]{8}$/`. |
| **SUGG-1** | Missing risky-path regression tests | **RESOLVED** | 12 new tests: consensus +1, normalize +4, mcp +7. Test baselines increased from Round-1 (mcp 47→54). |
| **SUGG-2** | Schema descriptions only; no bounds enforcement | **RESOLVED** | `schemas.ts:246-247` adds `minimum`/`maximum`. `assertFiniteRange()` at `handlers.ts:556-562` rejects non-number/NaN/Infinity/out-of-range; `undefined` allowed for optional fields. |

### MAJOR-1 design note — `financial.ts` intentionally unchanged

Confirmed correct. `uvrn-normalize/src/normalize/transformers/financial.ts` still regex-parses title/snippet and labels values as **USD**. MCP handler only calls `normalize(..., 'general')`, so preferring `evidenceScore` in `financial` would mislabel scores as currency. No change required.

---

## Split-brain probe (critical)

**Round-1 failure mode:** title `"Top 10 trend report"` + `evidenceScore: 80` scored on **10**, not 80.

**Probe input (built `dist`, `handleScoreClaim`):**

```json
{
  "claim": "Split-brain probe",
  "sources": [
    { "url": "https://example.com/a", "title": "Top 10 trend report", "snippet": "Strong demand", "evidenceScore": 80 },
    { "url": "https://example.com/b", "title": "Top 99 movers", "snippet": "Cooling off", "evidenceScore": 60 }
  ]
}
```

**Result:**

```json
{
  "v_score": 82.5,
  "evidenceMode": "host_sources",
  "sourceCount": 2,
  "consensusComponents": {
    "completeness": 100,
    "parity": 50,
    "freshness": 100
  },
  "normalizedValues": [80, 60],
  "disagreeMeasurement": {
    "type": "disagree",
    "verdict": "disagree",
    "confidence": 0.2857142857142857
  }
}
```

**Interpretation:**

| Signal | Value | Pre-fix (title numbers) would be |
|--------|-------|----------------------------------|
| Normalized measurements | **80, 60** | 10, 99 |
| Numeric spread | **0.286** (`\|80−60\| / 70`) | ~1.633 (`\|99−10\| / 54.5`) |
| `v_score` | **82.5** (parity 50 from 80/60 divergence) | Would reflect 10 vs 99 parity |

Both consensus (`v_score` / components) and normalize (`normalizedValues` → measurements) reflect **evidenceScore**, not title numbers. Split-brain eliminated.

---

## Build and test results

Commands (offline flag):

```bash
pnpm install
pnpm --filter "@uvrn/mcp..." --config.verify-deps-before-run=false run build   # PASS
pnpm --filter "@uvrn/drift"    --config.verify-deps-before-run=false run build   # PASS
pnpm --filter "@uvrn/mcp" --filter "@uvrn/consensus" --filter "@uvrn/normalize" \
     --filter "@uvrn/score" --filter "@uvrn/core" --filter "@uvrn/agent" \
     --config.verify-deps-before-run=false run test   # PASS
pnpm --filter "@uvrn/drift" --config.verify-deps-before-run=false run test   # PASS (16)
```

| Package | Expected | Actual | Status |
|---------|----------|--------|--------|
| `@uvrn/core` | 17 | 17 | PASS |
| `@uvrn/agent` | 7 | 7 | PASS |
| `@uvrn/normalize` | 11 | 11 | PASS |
| `@uvrn/consensus` | 8 | 8 | PASS |
| `@uvrn/score` | 6 | 6 | PASS |
| `@uvrn/mcp` | 54 | 54 | PASS |
| `@uvrn/drift` | — | 16 | PASS |

---

## Adversarial probe matrix

| Probe | Expected | Actual | Status |
|-------|----------|--------|--------|
| Numeric titles + divergent `evidenceScore` (80/60) | Score on 80/60 | `v_score` 82.5, values [80,60], spread 0.286 | PASS |
| `evidenceScore: 0` with numeric title "Top 10" | Honor 0 | normalized [0, 50] | PASS |
| Decimal `evidenceScore` | Honored | normalize unit test: 42.5 | PASS |
| Missing `evidenceScore` | Regex fallback | `v_score` 82.5 from snippet numbers 73/75 | PASS |
| Negative `evidenceScore: -5` | ValidationError | `evidenceScore must be a finite number between 0 and 100` | PASS |
| Exactly 1 host source | ValidationError | `Host evidence requires at least 2 sources` | PASS |
| `sources: []` | Falls through to mock | `evidenceMode: mock` | PASS |
| `sources` omitted | Falls through to mock | `evidenceMode: mock` | PASS |
| Host + configured connectors | Host wins | `evidenceMode: host_sources`, connector not called | PASS |
| MAJOR-2 weight regression | Byte-identical, no score change | `WEIGHTS === VSCORE_WEIGHTS`, fixed input final 85.5 | PASS |
| Snippet-prefix workaround | Removed | No prefix in handler; grep clean | PASS |

`< 2` merged-sources guard: covered by existing handler tests (connector failure → `ExecutionError` with nodes). Dedupe-to-1-usable → `ConsensusError` wrapped as `ExecutionError` — unchanged pre-existing behavior.

---

## Design rule review

| Rule | Status |
|------|--------|
| V-Score formula lives only in `@uvrn/core` | **PASS** — `VSCORE_WEIGHTS` in core; score/drift consume via re-export |
| No circular dependencies | **PASS** — core → score → drift → mcp |
| Zero-external mock path intact | **PASS** — omitted/empty sources → `DefaultMockConnector`, `evidenceMode: mock` |
| MasterReceipt structure/hash unchanged | **PASS** — core golden/additive tests pass (17/17) |
| Provider-agnostic at type level | **PASS** — `HostSource` → `FarmSource` field map, no provider imports |
| No storage added to core/drift/agent | **PASS** |

---

## New findings (introduced by remediation)

### Operational (non-blocking)

**Remediation uncommitted.** The 13-file fix set is in the working tree only. PR remote / committed HEAD still has the Round-1 snippet-prefix bug. Merge requires committing and pushing remediation first.

### Suggestion (non-blocking)

**MCP E2E test could assert extraction values, not just finiteness.** Test `should score host sources by evidenceScore even when titles contain numbers` checks finite `v_score` but not `v_score ≈ 82.5` or disagree spread ≈ 0.286. Lower-level consensus/normalize tests cover extraction; recommend strengthening MCP assertion in a follow-up.

### Pre-existing (out of scope, not a NO-GO)

When `evidenceScore` is **omitted**, negative numbers in title/snippet can still enter via regex fallback. Handler validates explicit `evidenceScore` only. Unchanged from pre-PR behavior.

### Deferred (explicitly out of scope)

- Governance doc reconciliation (ROADMAP, CLAUDE.md rule #1 wording, COUPLINGS.md)
- POD report regeneration
- Removing committed `uvrn-core/src/*.js` / `*.d.ts` artifacts
- Publishing `VSCORE_WEIGHTS` to npm `@uvrn/core` consumers (requires core minor publish)

---

## Comparison to Round 1

| | Round 1 | Round 2 |
|---|---------|---------|
| Verdict | NO-GO | **GO** |
| Host evidence scoring | Title numbers silently win | `evidenceScore` field preferred in consensus + normalize |
| Weights source of truth | Duplicated in `@uvrn/score` | Canonical in `@uvrn/core` |
| 1 host source | Silent fallback | ValidationError |
| `sourceCount` | Raw merged count | Post-parse/post-dedupe |
| `claimId` | Collision-prone slug | Slug + 8-char hash |
| Tests (mcp) | 47 | 54 |

---

*Round-2 re-audit complete. Remediation verified in working tree; commit before merge.*
