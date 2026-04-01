# @uvrn/canon

> The canonization layer for the UVRN protocol.
> The final step in the TVC loop: **Test → Validate → Canonize.**

Part of the [UVRN](https://uvrn.org) ecosystem.

---

## What canonization means

A drift receipt is a point-in-time score. It can be updated, superseded, or forgotten.

A **canon receipt** is permanent. It says:

> *"At this moment, this claim was verified to this score, by these sources, witnessed by this signature — and that fact is now locked forever."*

Nobody can change it. Anyone can verify it. The public key is embedded in the receipt itself.

**Package provides:** `Canon`, `NodeSigner`, `MockSigner`; stores (`R2Store`, `SupabaseStore`, `IpfsStore`, `MultiStore`, `MockStore`); `qualify`, `suggest`, `canonize`, `verify`. DRVC3 v1.01 receipt shape; verification from embedded public key.

**You provide:** At least one store (R2 bucket, Supabase client, or IPFS client); a signer (e.g. `NodeSigner` with private key); `canonizerId`. Drift receipt and snapshot to canonize (e.g. from `@uvrn/agent` or manual).

---

## Install

```bash
npm install @uvrn/canon @uvrn/drift @uvrn/core
```

---

## Quick start

```typescript
import { Canon, NodeSigner, MultiStore, R2Store, SupabaseStore } from '@uvrn/canon'

const canon = new Canon({
  stores: [
    new MultiStore([
      new R2Store(env.R2_BUCKET),
      new SupabaseStore(supabaseClient),
    ])
  ],
  signer:      new NodeSigner(process.env.UVRN_PRIVATE_KEY),
  canonizerId: 'uvrn-agent-prod-01',
  autoSuggest: {
    enabled:         true,
    consecutiveRuns: 3,      // 3 stable runs → suggest
    minScore:        85,     // must be above 85
    suggestionTtlMs: 24 * 60 * 60 * 1000,  // suggestion expires in 24h
  },
})
```

---

## The two-step flow

### Step 1 — Agent records runs, Canon auto-suggests

```typescript
// In @uvrn/agent — after each verification run:
const suggestion = await canon.recordRun(claimId, snapshot)

if (suggestion) {
  await notify({
    message: `Claim ${claimId} ready to canonize`,
    score:   suggestion.qualifying_score,
    id:      suggestion.suggestion_id,
  })
}
```

### Step 2 — Human confirms, Canon executes

```typescript
const result = await canon.canonize({
  driftReceipt:  lastReceipt,
  finalSnapshot: lastSnapshot,
  trigger: {
    type:          'auto_suggest',
    confirmed_by:  'shawn',
    suggestion_id: suggestion.suggestion_id,
  },
  suggestionId: suggestion.suggestion_id,
})

console.log(result.receipt.canon_id)
console.log(result.receipt.content_hash)
console.log(result.verified)
```

---

## Stores

| Store | Use |
|---|---|
| `R2Store(bucket)` | Cloudflare R2 — fast, cheap, CF Workers native |
| `SupabaseStore(client)` | Queryable — filter by score, date, claim |
| `IpfsStore(client)` | Content-addressed — CID IS the checksum |
| `MultiStore([...])` | Fan-out to all simultaneously |
| `MockStore` | Testing — in-memory, no network |

---

## Verify any receipt

Anyone can verify a canon receipt without trusting the issuer:

```typescript
const isValid = await canon.verify(receipt)
```

---

## Manual canonization

```typescript
const result = await canon.canonize({
  driftReceipt:  receipt,
  finalSnapshot: snapshot,
  trigger: {
    type:         'manual',
    confirmed_by: 'shawn',
    reason:       'auditor requested permanent record',
  },
})
```

---

## License

MIT · [uvrn.org](https://uvrn.org)
