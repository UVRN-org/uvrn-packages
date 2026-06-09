# Findings — `@uvrn/mcp` `delta_score_claim` host-evidence (PR #4)

**Date:** 2026-06-08
**Triage by:** Claude Code (protocol/integration lead)
**Source audit:** `.admin/audits/audit-mcp-2026-06-08.md` (OpenAI Codex, Round 1 — **NO-GO**)
**Re-audit:** `.admin/audits/audit-mcp-2026-06-08-round2.md` (Round 2 — **GO**)
**PR:** #4 · branch `feat/score-claim-enrichment` → base `feat/trend-engine-layer-v1`
**Remediation log:** `.admin/reports/report-pr4-remediation-worklog-2026-06-08.md`

This document closes the Bloom audit loop (Audit → Findings → Fix → Re-audit) for PR #4.

---

## Triage summary

| ID | Severity | Finding | Disposition | Status |
|----|----------|---------|-------------|--------|
| MAJOR-1 | Major | `evidenceScore` injected via snippet prefix; numeric titles override it (silent mis-scoring) | Fix — typed `FarmSource.evidenceScore` field; both extractors prefer it | ✅ Resolved |
| MAJOR-2 | Major | V-Score weights redefined in `@uvrn/score`; house rule says `@uvrn/core` | Fix — `VSCORE_WEIGHTS` in core; score re-exports | ✅ Resolved |
| MINOR-1 | Minor | Exactly one host source silently falls through to connector/mock | Fix — `ValidationError` (host mode requires ≥2) | ✅ Resolved |
| MINOR-2 | Minor | `sourceCount` reports raw merged count, overstating sources scored | Fix — `consensus.stats.sourceCount` (post-parse/dedupe) | ✅ Resolved |
| MINOR-3 | Minor | Derived `claimId` slug not collision-safe | Fix — slug + 8-char sha256 suffix | ✅ Resolved |
| SUGG-1 | Suggestion | Tests cover only the happy path | Fix — 12 dedupe-aware regression tests | ✅ Resolved |
| SUGG-2 | Suggestion | Schema lacks bounds; no finite-range check | Fix — schema min/max + `assertFiniteRange` guard | ✅ Resolved |

All findings were in the runtime lane and are resolved in the PR branch (commit `ac8f7e6`). No
critical findings were raised.

---

## Root cause (MAJOR-1)

The host-evidence feature smuggled a structured number (`evidenceScore`) into a free-text field by
prefixing the `snippet` with `"evidenceScore: N. "`. Downstream numeric extraction read
`` `${title} ${snippet}` `` and took the **first** number — so any number in the title (year, "Top 10",
ranking, price) won over the intended score. Result: a finite, canonical-looking `v_score` computed
from the wrong value. Silent mis-scoring, not a loud failure. The same broken extraction existed in
**two** places (`@uvrn/consensus` → `v_score`; `@uvrn/normalize` → `measurements`), so a one-sided fix
would have produced a "split-brain" receipt.

**Fix:** add a real `FarmSource.evidenceScore?: number` field; have both numeric extractors prefer it
(regex retained as fallback). `@uvrn/normalize` `financial.ts` was intentionally left unchanged (it
labels parsed numbers as USD; the handler only ever calls the `general` profile).

---

## Resolution detail & verification

- **Build:** all 13 affected packages + `@uvrn/drift` build clean (offline flag).
- **Tests:** core 17 · agent 7 · normalize 11 · consensus 8 · score 6 · mcp 54 · drift 16 — all pass.
- **Split-brain probe (numeric titles, evidenceScore 80/60):** consensus and measurements both reflect
  the evidence scores (spread 0.286 = 80/60), not the title numbers (10/99). Verified independently in
  Round 2.
- **MAJOR-2 invariance:** weights moved byte-identical → no `v_score` change for fixed input.

---

## Governance reconciliation completed (this session)

The "weights ownership" claim previously contradicted itself across the docs. All reconciled to one
target wording — *`@uvrn/core` owns `VSCORE_WEIGHTS`; `@uvrn/score` re-exports them as `WEIGHTS` and
decomposes; `@uvrn/drift` imports `WEIGHTS` from `@uvrn/score` (passthrough, not duplication)*:

`CLAUDE.md` rule #1 · `AGENTS.md` rule #1 (+ new rule #14: no string-encoding of protocol data) ·
`ROADMAP.md` · `README.md` (V-Score section + package table + MCP surface) · `COUPLINGS.md` ·
`.admin/executive/ARCHITECTURE-uvrn-master.md` · `uvrn-score/README.md` · `uvrn-consensus/README.md` ·
`uvrn-drift/README.md` · `uvrn-mcp/README.md` (`delta_score_claim` section rewritten with host-evidence
guidance).

---

## Post-merge / out-of-scope notes (action required later)

1. **`@uvrn/core` npm publish.** Core is live on npm (v1.1.0, publishes from `dist/`). `VSCORE_WEIGHTS`
   is additive but reaches external consumers only after a later **core minor** publish. Until then,
   `@uvrn/score` consumes it via the workspace/peer link, which is fine in-repo.
2. **`@uvrn/core` edit authorization (audit trail).** `AGENTS.md` requires explicit authorization to
   edit shared `@uvrn/core` types. The approved PR #4 triage plan
   (`read-this-plan-cheeky-raven.md`, MAJOR-2) **is** that authorization for the additive
   `VSCORE_WEIGHTS` export. Recorded here for the trail.
3. **POD report regeneration (deferred).** `pod-trends-report.html` was generated with the buggy
   scores; rankings shift now that `evidenceScore` drives scoring. Regenerate **after merge** so the
   report reflects merged code, not the branch.
4. **Committed `uvrn-core/src/*.js` / `*.d.ts` artifacts (separate cleanup).** Core is the only package
   that commits build artifacts next to `.ts` sources; this forced a manual 3-file mirror of
   `VSCORE_WEIGHTS`. Worth removing so `tsc` → `dist/` is the single build path. Logged, not done here.
5. **Re-audit closed.** Round 2 returned GO. Remaining merge gate is the standard PR review/merge.

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue. This findings doc + the doc
reconciliation are the Update/Reflect steps for the PR #4 cycle.*
