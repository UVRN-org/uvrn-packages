---
name: uvrn-validate
description: >-
  Easy-verify a DataPoint via @uvrn/validate or MCP delta_validate_datapoint.
  Stage1 shape only; Stage2 only on explicit runStage2 flag. Never say verified.
---

# uvrn-validate — agent skill

## When to call

- Caller has a **DataPoint** (`id`, `kind`, `value`, optional `sourceRef`) and wants an honest
  structural check — not a DeltaBundle (`delta_validate_bundle`) and not a receipt hash check
  (`delta_verify_receipt`).
  `sourceRef` is Stage1-shaped only in v0 and does **not** feed Stage2; Stage2 is
  host-sources-only (connectors/mock/`score_claim` full path = expand-later).
- Optionally, with an explicit Stage2 flag and host sources, wants relational measure tokens
  without inventing a second scoring engine.

**Prefer:** `validateDataPoint()` from `@uvrn/validate`, or MCP tool `delta_validate_datapoint`.

## Hard honesty rules

1. **Never say verified.** This surface cannot earn `verified` (that requires integrity + producer
   signature on a signed receipt path elsewhere).
2. **Disclose which stage** produced the answer (`stage: 1` shape vs `stage: 2` relational).
3. **Stage1 tokens only:** `structurally-ok` | `malformed`. Do **not** call Stage1
   `integrity-checked` — that word is receipt hash-recompute only.
4. **`insufficient-data` is success** — an honest Stage2 outcome when `runStage2` is on and fewer
   than two host sources are available. Report it plainly; do not invent evidence to fill the gap.
5. **Stage2 is flag-only.** Never auto-run measure/connectors/mock because sources might exist.
6. **Do not overload** `delta_validate_bundle` — bundles ≠ DataPoints.

## Stage2

- Requires `runStage2: true` (or MCP equivalent) plus host `sources` (not `sourceRef`).
- Routes into existing `@uvrn/measure` starter verdicts. Headline token prefers agree:
  `agree` | `no-agreement` | `insufficient-data`; first-measurement fallback may also
  surface `disagree` | `none` | `conflict` | `potential`.
- No new measurement math. No claim of `verified`.
