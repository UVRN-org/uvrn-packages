# Finding — MCP Option A: no `delta_enrich_receipt`

**Date:** 2026-06-05  
**Workstream:** trend-engine-layer-v1  
**Status:** Recorded decision

## Summary

Phase 2 does not add `delta_enrich_receipt`. The approved Option A path keeps enrichment outside MCP: callers must pass the already enriched shapes required by downstream packages.

## Consequence

- `delta_score_drift` requires a `DriftInputReceipt` with `receipt_id`, `issuer`, `timestamp`, `v_score`, and `components`.
- `delta_compare` requires exactly two receipts carrying `claimId` or `claim_id` plus `vScore` or `v_score`.
- A raw `DeltaReceipt` from `@uvrn/core` is rejected by both tools because it does not contain V-Score or component fields.

## Rationale

`@uvrn/score` cannot derive completeness, parity, and freshness from a bare `DeltaReceipt`; those components originate upstream in consensus/scoring flows. Adding an enrich tool that accepts a raw receipt would imply data the receipt does not contain.
