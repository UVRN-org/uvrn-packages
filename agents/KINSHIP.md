# KINSHIP — filing habit for related findings

Universal instructions for agents that connect one research receipt to another: when to reuse exact identity, when to write one of the **existing five** `rel` types, when to tag only, and when to mint a **new claim**.

This file does not add hashed fields. It does not rename `rel` types to PROV-O. It does not change `SPEC/` or the worker.

## Exact vs written vs not-proof

| Kind | What it is | Proof level |
|------|------------|-------------|
| **Exact** | Same `claimId` / `chainId` after cleanup (`SPEC/uvrn-claim-id-v1.md` §2.1). Re-run → new receipt, same ids. | Measurement + hash on each run. Compare/drift tools apply. |
| **Written** | `links[]` on the envelope: `hash` (`sha256:` + 64 hex), `rel`, optional `label` ≤256 chars (≤50 links). | Agent-stated relationship between receipts. **Not** measurement proof. |
| **Not proof** | Tags, topic labels, narrative prose, “sources agree,” vibe clustering. | Display or filing hints only. Do not hash interpretation. |

**Written link ≠ measurement proof.** A `references` edge does not mean DualAccuracy consensus. UVRN agreement lives in the measurement payload, not in `rel`.

## Five `rel` types (use only these)

| `rel` | Write it when | Do not write it when |
|---|---|---|
| `follows` | This run continues the same research thread (next measurement of a declared prior receipt). | The sentence changed enough to be a new claim — then new ids, optional `references`. |
| `caused-by` | This finding is declared as following from a prior **receipt** (agent-stated cause). | You want to say the *world* caused the claim. Links are receipt-to-receipt, not physics. |
| `references` | This receipt cites another receipt as related reading / prior art / disagreement partner. | You want to smuggle “sources agree.” Agreement is in the payload, not `rel`. |
| `part-of` | This run is a piece of a larger declared set (one question split across receipts). | You are clustering by vibe. Likeness helper is parked — see attic plan 02. |
| `responds-to` | This run answers or rebuts a specific prior receipt. | Generic “about the same topic.” Use `references` or a new claim. |

## When to use what

**Same claim ids (re-run):** score again → new receipt → **same** claim ids. That is exact identity. You may also `follows` the prior run’s hash, but re-run is not a substitute for `follows`.

**Write `links[]`:** pick exactly one of the five `rel` values above when you need a declared receipt-to-receipt edge.

**Tags only:** optional `tags?: string[]` on the envelope for cross-cutting labels. Tags are **not** a D1 query column today. Queryable D1 labels remain `topic`, `kind`, `claimId`, `chainId`.

**New claim (no silent join):** if cleanup yields a different `canonicalClaimId`, it is a different sentence. Mint a new claim. Optionally `references` the old receipt. Do **not** copy old ids to make a chart look continuous.

## Walls (do not violate)

1. Additive-only against live receipts. This file adds **no** hashed fields.
2. Do not rename the five `rel` types to PROV-O in SPEC or code.
3. Do not expect the worker to auto-write links on ingest.
4. Do not treat `references` as DualAccuracy agreement.
5. Likeness helper (written “similar to” without exact ids) is **parked** — no build from this guide.

## Cite

- Full attic suite (vocabulary + parked likeness): [`.admin/docs/plan-suites/uvrn-finding-kinship/`](../.admin/docs/plan-suites/uvrn-finding-kinship/)
- Link type surface: `uvrn-receipt/src/types/index.ts` → `NetworkReceiptLink`
- Claim identity: `SPEC/uvrn-claim-id-v1.md`
- Binding laws: [`AGENTS.md`](../AGENTS.md)
