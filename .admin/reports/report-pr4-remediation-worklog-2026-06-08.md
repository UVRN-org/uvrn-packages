# Work Log — PR #4 Audit Remediation (`delta_score_claim` host-evidence)

**Date:** 2026-06-08
**Author:** Claude Code (runtime-implementer lane)
**For:** Shawn / Suttle Media — admin & dev teams (machine + human), context record
**Project:** `uvrn-packages-next` · UVRN (Universal Verification Receipt Network)
**Branch / PR:** `feat/score-claim-enrichment` → base `feat/trend-engine-layer-v1` (PR #4)
**Worktree:** `uvrn-packages_LIVE-BUILDS-PRIVATE_score-claim-enrichment-pr4`
**Status at end of session:** ✅ Runtime work complete, build + tests + smokes green. **HELD before commit** pending Shawn's approval.

---

## 1. Purpose of this session

OpenAI Codex audited PR #4 and returned a **NO-GO** verdict
(`.admin/audits/audit-mcp-2026-06-08.md`). My job was to execute the approved triage plan
(`~/.claude/plans/read-this-plan-cheeky-raven.md`) and take PR #4 from **NO-GO → GO**, working
**only in the runtime lane** (source + tests + package READMEs). The governance lane (CLAUDE.md,
AGENTS.md, ROADMAP.md, COUPLINGS.md, `.admin/` docs) was explicitly out of scope and remains with
Claude Code / protocol lead.

---

## 2. The core bug (why it was a NO-GO)

`delta_score_claim` added a host-evidence path: a calling agent can supply its own web sources with an
`evidenceScore` (0–100). The original implementation **smuggled that score into the text** by prefixing
the source's `snippet` with `"evidenceScore: N. "`. Downstream, the numeric extractor read
`` `${title} ${snippet}` `` and took the **first number it found**.

**Failure mode:** real search-result titles routinely contain numbers — years, "Top 10", rankings,
prices. Any such number appears *before* the prefixed snippet score and **wins**. The result was a
finite, canonical-looking `v_score` computed from the **wrong number** — silent mis-scoring, not a
loud validation failure. This corrupted the POD trends report.

**Critical subtlety the plan flagged:** the broken extraction existed in **two** places —
`@uvrn/consensus` (drives `v_score`) and `@uvrn/normalize` (drives the MasterReceipt `measurements`).
Fixing only one would yield a "split-brain" receipt where the headline score and the measurements
disagree. Both had to be fixed.

---

## 3. What was decided (carried in from the plan)

- **MAJOR-1** → add a real `FarmSource.evidenceScore` numeric field; have both numeric extractors
  *prefer* it, falling back to the existing regex when absent. (Additive, backward-compatible.)
- **MAJOR-2** → move the V-Score weights to `@uvrn/core` (house rule #1 says the formula lives only in
  core); `@uvrn/score` re-exports them. Byte-identical values → no score change.
- Land fixes on the existing PR #4 branch. Regenerate the POD report **later** (deferred).

---

## 4. Work completed

### Step 0a — Preflight type search
Confirmed `FarmSource` is defined in exactly one place (`uvrn-agent/src/types/index.ts:42`) and
re-exported by both `@uvrn/consensus` and `@uvrn/normalize` (no local stricter redefinition that would
reject a new field). `@uvrn/mcp` has its own `HostSource` interface which already carried
`evidenceScore`. Conclusion: adding the field to `@uvrn/agent` was sufficient and safe.

### MAJOR-1 — reliable evidence score (5 edits)
1. **`uvrn-agent/src/types/index.ts`** — added optional `evidenceScore?: number` to `FarmSource`, with
   a doc comment explaining the precedence intent.
2. **`uvrn-consensus/src/engine/aggregation.ts`** — `extractMetricValue()` now returns
   `source.evidenceScore` first when it's a finite number, before the `${title} ${snippet}`
   first-number regex.
3. **`uvrn-normalize/src/normalize/transformers/general.ts`** — `general` profile prefers
   `evidenceScore` before `extractNumericValue(...)`.
   - **Deliberately did NOT touch `financial.ts`.** That profile labels parsed numbers as **USD**;
     preferring `evidenceScore` there would mislabel `80` as `80 USD`. The MCP handler only ever calls
     `normalize(..., 'general')`, so `general` is the only profile in scope.
4. **`uvrn-mcp/src/tools/handlers.ts`** — host-source mapping now sets the `evidenceScore` field
   directly and leaves `snippet` clean. Removed the stale snippet-prefix workaround and its comment.

### MAJOR-2 — single source of truth for V-Score weights
- **`uvrn-core/src/types/index.ts`** — added
  `export const VSCORE_WEIGHTS = { completeness: 0.35, parity: 0.35, freshness: 0.3 } as const;`
- **Committed-artifact mirror (core only):** `uvrn-core/src` tracks sibling `.js` + `.d.ts` next to
  each `.ts` (a pre-existing smell — the other 5 packages are `.ts`-only). Mirrored the new constant
  into `uvrn-core/src/types/index.js` and `index.d.ts` so the tracked artifacts don't go stale.
- **`uvrn-score/src/types/index.ts`** — now `import { VSCORE_WEIGHTS } from '@uvrn/core'` and
  `export const WEIGHTS = VSCORE_WEIGHTS;`. Public name `WEIGHTS` preserved so `@uvrn/drift` keeps
  working unchanged. No circular dependency (core depends on nothing; score already peer+dev-deps core).

### MINORs
- **MINOR-1** — exactly one host source now throws a `ValidationError` ("Host evidence requires at
  least 2 sources") instead of silently falling through to connectors/mock. Documented the intentional
  precedence: any non-empty `sources` array = host mode requested; empty/omitted may fall through.
- **MINOR-2** — `sourceCount` now reports `consensus.stats.sourceCount` (post-parse, post-dedupe),
  not the raw merged count. Doc comment updated in `uvrn-mcp/src/types.ts`.
- **MINOR-3** — derived `claimId` is now collision-resistant: human-readable slug **+** an 8-char
  SHA-256 hash of the original claim (`createHash` from `node:crypto`).

### SUGGESTIONs
- **SUGGESTION-2** — schema bounds + handler-side validation. Added `minimum`/`maximum` to
  `credibility` (0–1) and `evidenceScore` (0–100) in `schemas.ts`, plus an `assertFiniteRange()` guard
  applied to every host source (rejects non-number, NaN, Infinity, out-of-range — clients may not
  enforce the schema).
- **SUGGESTION-1** — dedupe-aware regression tests (12 new tests total):
  - **consensus** (1): 3 sources with divergent numeric titles but equal `evidenceScore: 50`, dates
    spaced >1 day apart (so dedupe doesn't merge them) → `agreementScore === 100`.
  - **normalize** (4): prefer `evidenceScore` over numeric title; honor `0`; honor decimals; fall back
    to regex when absent.
  - **mcp** (7): numeric-title host scoring; `sourceCount` drop case (non-numeric dropped → 2);
    `sourceCount` dedupe case (near-identical merged → 2); 1-source `ValidationError`; host-over-
    connector precedence; out-of-range/non-finite rejection; collision-resistant `claimId` shape.

---

## 5. Issues encountered & how they were resolved

| Issue | Resolution |
|---|---|
| **Split-brain risk** — fixing only consensus would leave `measurements` reading title numbers. | Fixed both extractors (consensus + normalize `general`) and verified both halves in the smoke. |
| **`financial.ts` trap** — naively applying the same fix would mislabel scores as USD. | Left `financial.ts` untouched; only `general` is reachable from the handler. |
| **Committed `.js`/`.d.ts` in `uvrn-core/src`** — stale artifacts would drift from the new `.ts`. | Mirrored `VSCORE_WEIGHTS` into all three files. (Removing the committed artifacts entirely is logged as a separate cleanup, out of scope here.) |
| **Dedupe window in tests** — equal values dedupe if within 1 day. | Spaced equal-score fixtures >1 day apart so the regression test actually keeps 3 sources. |
| **pnpm registry pre-check hangs** (the audit's "stuck build"). | Used `--config.verify-deps-before-run=false` on all build/test commands, per the plan. |
| **Measurements don't store raw numeric values** — couldn't grep a `"value": N` to prove the normalize fix. | The `disagree` measurement reports "diverge by **0.286**" = (80−60)/70. Title numbers (10 vs 99) would give ~1.6. The 0.286 figure conclusively proves measurements derive from `evidenceScore`. |

---

## 6. Verification results

**Build** (offline flag): `@uvrn/mcp...` (13 packages: core, score, agent, consensus, normalize,
canon, drift, test, farm, compare, measure, identity, mcp) — all clean. `@uvrn/drift` (imports
`WEIGHTS` from `@uvrn/score`) — clean. `tsc` build doubles as the typecheck.

**Tests:** core 17 · agent 7 · normalize 11 · consensus 8 · score 6 · mcp 54 — **all pass** (was 47
mcp tests at audit time; +7 new handler tests, +5 across consensus/normalize).

**End-to-end smokes (against built `dist`):**
- Mock path (no sources) → `evidenceMode: 'mock'`, all four output fields present.
- Host path equal scores (50/50, divergent titles) → `v_score 93.5`.
- Host path divergent scores (80/60) → `v_score 76`. The gap proves consensus reads `evidenceScore`.
- Split-brain: measurements report divergence 0.286 (= 80/60), not title-derived. ✅
- 1 host source → `ValidationError`. Out-of-range `evidenceScore` → `ValidationError`. ✅

**Scope check:** 13 files changed, all runtime-lane (uvrn-agent / consensus / core / mcp / normalize /
score). No governance files touched. `dist/` is gitignored.

---

## 7. Completed vs. outstanding

### ✅ Completed
- All audit findings in the runtime lane: MAJOR-1, MAJOR-2 (code), MINOR-1/2/3, SUGGESTION-1/2.
- Build, tests, and smokes green. Split-brain eliminated and verified on both halves.

### ⏳ Outstanding / deferred
- **Commit + push + PR update** — HELD, awaiting Shawn's explicit approval (not yet done).
- **Governance lane** (Claude Code / protocol lead): reconcile the "weights ownership" wording across
  the 6 docs (ROADMAP.md, CLAUDE.md rule #1, README.md, `.admin/executive/ARCHITECTURE-uvrn-master.md`,
  COUPLINGS.md, uvrn-drift/README.md); write `.admin/findings/findings-mcp-2026-06-08.md`.
- **POD report regeneration** — deferred follow-up. Rankings change now that `evidenceScore` drives
  scoring; re-run after merge.
- **Re-audit** — hand PR back to Codex for a GO confirmation.
- **Separate cleanups (logged, not done):** remove the committed `uvrn-core/src/*.js` / `*.d.ts`
  artifacts; `@uvrn/core` is live on npm (v1.1.0, publishes from `dist/`), so shipping `VSCORE_WEIGHTS`
  to external consumers needs a later core **minor** publish.

---

## 8. Ideas / revelations for the record

- **String-prefixing as a protocol carrier is an anti-pattern.** The whole bug stems from encoding a
  structured number inside free text. Codex's design note agrees: snippet mutation should never become
  the protocol path. The proper-field fix is the durable answer (survives zod, field-stripping, etc.).
- **`evidenceScore` is the measurement; `credibility` is the weight.** The audit's sharpest insight:
  these are two different concepts. Treating the score as the measured value (via parsing) while
  credibility stays a separate weighting concept is the correct model — and explains the previously
  "low V-Score clustering" smell.
- **The committed `src/*.js`/`*.d.ts` in `@uvrn/core` is a real liability.** It's the only package that
  does this, it's gitignore-inconsistent with the other 5, and it forced a manual 3-file mirror.
  Worth a dedicated cleanup so `tsc` → `dist/` is the single build path everywhere.
- **`sourceCount` semantics matter to downstream clients.** It's now explicitly the post-parse/
  post-dedupe count. Anyone using it as provenance/confidence metadata should rely on that definition.

---

## 9. Files changed (13)

```
uvrn-agent/src/types/index.ts                          + evidenceScore? field
uvrn-consensus/src/engine/aggregation.ts               extractMetricValue prefers evidenceScore
uvrn-consensus/tests/consensus.test.ts                 + equal-score / numeric-title regression
uvrn-core/src/types/index.ts                           + VSCORE_WEIGHTS
uvrn-core/src/types/index.js                           mirror VSCORE_WEIGHTS (committed artifact)
uvrn-core/src/types/index.d.ts                         mirror VSCORE_WEIGHTS (committed artifact)
uvrn-mcp/src/tools/handlers.ts                          field mapping; MINOR-1/2/3; finite-range guard
uvrn-mcp/src/tools/schemas.ts                           min/max bounds; precedence note
uvrn-mcp/src/types.ts                                   sourceCount doc comment
uvrn-mcp/src/__tests__/tools/handlers.test.ts          + 7 host-path regression tests
uvrn-normalize/src/normalize/transformers/general.ts   prefer evidenceScore (general only)
uvrn-normalize/tests/normalize.test.ts                 + 4 evidenceScore tests
uvrn-score/src/types/index.ts                          WEIGHTS re-sourced from @uvrn/core
```

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue. This session covered Build →
Check. Update (CHANGELOGs/READMEs) and the governance Reflect are the next steps, pending approval.*
