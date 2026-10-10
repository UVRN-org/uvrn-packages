# UVRN Network Specification v1 (`uvrn-network-v1`)

**Status:** Normative · **Date:** 2026-06-10 · **Generation:** v4 / fable-refactor-1
**Depends on:** `uvrn-receipt-v1.md`, `uvrn-signing-v1.md`
**Reference implementation:** `uvrn-worker` (Cloudflare Worker + D1 `uvrn-receipts`)

The UVRN network is an append-only public receipt registry. This document is the API contract any
client implements — the uvrn.org portal, the desktop dashboard, `@uvrn/store-sqlite`'s
`pushToNetwork()`, and third parties. The D1 database behind `uvrn-worker` is the central network
home; local stores are satellites that push to it.

Base URL (current registry): `https://uvrn-worker.uvrn-workers.workers.dev`

---

## 1. Principles

1. **Append-only.** No DELETE or UPDATE paths exist. Corrections are new receipts linked with
   `rel: 'responds-to'`.
2. **Store-and-flag, never silently drop.** Anomalies (SDK integrity mismatch, invalid producer
   signature) are recorded as flags on the stored receipt.
3. **Old shapes live forever.** `drvc3-receipt-1` submissions remain accepted byte-identically.
4. **Reads are public; writes are keyed.**

## 2. Authentication

- Write endpoints: `Authorization: Bearer <key>` or `X-UVRN-API-Key: <key>`.
- Scoped keys: the registry maps each key to an allowed `source` list (`KEY_SOURCE_MAP`);
  a submission whose `source` is outside the key's scope is rejected 403.
- Rate limits: 100 req/min per key (or per IP for public endpoints). Duplicate `receiptHash`
  within 60s → 429.
- Body limit: 64 KB.

## 3. Endpoints

### 3.1 Existing (v3, frozen behavior)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/receipts` | key | submit a receipt (§4) |
| GET | `/receipts/{hash}` | — | fetch one receipt by `sha256:<hex>` hash |
| GET | `/receipts/{hash}/links` | — | receipt + inbound/outbound links |
| GET | `/search` | — | filtered list; cursor pagination (`limit` ≤100, `cursor` = last `registryId`, returns `nextCursor`) |
| GET | `/chain/{chainId}` | — | all receipts in a named chain |
| POST | `/delta/ingest` | ingest secret | server-to-server delta ingest |
| POST | `/delta/run` | key | persist a pre-computed delta receipt |
| POST | `/delta/verify` | — | recompute a delta receipt hash |
| GET | `/admin/stats` | key | private counters |
| GET | `/.well-known/uvrn-keys.json` | — | registry Ed25519 public keys (`uvrn-signing-v1.md` §1.1) |
| GET | `/.well-known/uvrn-sdk-integrity.json` | — | known-good SDK integrity hashes |

### 3.2 New in schema v4 (Phase 5, additive)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/topics` | — | distinct topics with receipt counts and latest `registeredAt`, for portal navigation |
| GET | `/claims/{claimId}` | — | all receipts for one claim, newest first (claim timeline) |
| GET | `/stats/public` | — | cached public stats: totals, counts by topic/kind, last-7-days series |

Response shapes:

```
GET /topics        → { topics: [ { topic: string, count: number, latestAt: ISO8601 } ] }
GET /claims/{id}   → { claimId, receipts: [StoredReceipt], nextCursor }
GET /stats/public  → { total: number, byTopic: {..}, byKind: {..},
                       last7Days: [ { date: 'YYYY-MM-DD', count: number } ] }
```

## 4. Submission (`POST /receipts`)

Accepted `schemaVersion` values:

1. **`drvc3-receipt-1`** (frozen): required `schemaVersion, receiptHash, source, action,
   occurredAt, payload, sdk`; optional `tags, receiptType, narrative, links, chainId`. Hash
   recomputed per `uvrn-receipt-v1.md` §2.3; mismatch → 400.
2. **`uvrn-receipt-4`** (new): the NetworkReceipt envelope (`uvrn-receipt-v1.md` §3), validated
   against the `@uvrn/receipt` JSON Schema. Hash recomputed per §2.4. Registry persists `topic`
   and `claim.id` (column `claimId`) and maps `kind`. When a producer `signature` is present the
   registry verifies it (`uvrn-signing-v1.md` §2.4) and flags `SIGNATURE_VERIFIED` or
   `SIGNATURE_INVALID` — the receipt is stored either way.

Response: the `uvrn-receipt-4` path returns `{ ok: true, registryId, receiptHash, registeredAt,
uvrnSeal, flags }` (201). The frozen `drvc3-receipt-1` path keeps its historical response — the
full StoredReceipt row with 201 — byte-identical forever (the additive-only guarantee outranks
response-shape tidiness; recorded per finding F5-3). The registry seal is issued per
`uvrn-signing-v1.md` §3 in both cases.

**Single canonicalization implementation:** the registry's hash recompute imports
`@uvrn/receipt/canonical`. Hand-rolled duplicates (worker-local and site-local copies) are
retired in Phase 5/6.

## 5. Storage model (informative)

D1 `receipts` columns (v3): `registryId, receiptHash (unique), schemaVersion, source, action,
occurredAt, registeredAt, uvrnSeal, flags, receiptJson, receiptType, typeConfidence, vScore,
narrative, chainId`. v4 migration adds: `topic`, `claimId`, `kind` (+ indexes incl.
`idx_topic_registeredAt`, `vScore`). `receipt_links` is unchanged.

## 6. Satellite/push contract (dashboard + local stores)

A conformant satellite (desktop dashboard, `@uvrn/store-sqlite`) is exactly:

```
@uvrn/receipt   (object model, canonical, sign, HumanView)
+ local store   (@uvrn/store-sqlite — receipts persisted with a `synced` marker)
+ worker client (POST /receipts with the user's API key; mark synced on 2xx;
                 retry-with-backoff on 5xx; surface 4xx to the user — never mutate-and-retry)
```

Nothing else is required, and no satellite may define its own receipt shape
(`admin/plans/00-MASTER-PLAN.md` decision 2). `pushToNetwork(client)` submits unsynced receipts
oldest-first, honoring the rate limit.

## 7. Versioning

- Endpoint additions and response-field additions are non-breaking; clients MUST ignore unknown
  response fields.
- A change to an existing hash contract requires a new `schemaVersion` (never mutation).
- Schema migrations on D1 are additive `ALTER TABLE ... ADD COLUMN` only.
