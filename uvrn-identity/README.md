# @uvrn/identity

`@uvrn/identity` tracks signer reputation from protocol-verifiable facts only. The package owns the scoring logic and thresholds. Storage is pluggable through the `IdentityStore` interface.

## Minimal install

```bash
npm install @uvrn/identity @uvrn/core
```

## Usage

```ts
import { IdentityRegistry, MockIdentityStore } from '@uvrn/identity';

const registry = new IdentityRegistry({
  store: new MockIdentityStore(),
});

await registry.record({
  signerAddress: '0xA9F1...',
  receiptId: 'rec_001',
  vScore: 88,
  consensusVScore: 91,
  canonized: true,
  timestamp: Date.now(),
});

const rep = await registry.reputation('0xA9F1...');
```

## Evidence-based recording: `recordEvent()`

`recordEvent()` is the v4 path: each event may carry `AttestedEvidence` — an Ed25519 signature over the canonical JSON of `{ publicKeyRef, receiptHash, schemaVersion, sigVersion: 'uvrn-sig-1', signedAt? }`, verified against the raw 32-byte public key in `evidence.publicKey` (base64). Payload bytes use the shared environment-pure `@uvrn/core/canonical-serialize-2` module; identity contains no live serializer copy.

```ts
const result = await registry.recordEvent({
  signerAddress: '0xA9F1...', // used only when the event is unattested
  receiptId: 'rec_002',
  vScore: 88,
  consensusVScore: 91,
  canonized: true,
  timestamp: Date.now(),
  evidence: {
    receiptHash: 'sha256:…',
    schemaVersion: 'uvrn-receipt-4',
    signature: { alg: 'ed25519', publicKeyRef: 'uvrn:key:…', sig: '…' },
    publicKey: '…', // base64 raw 32-byte Ed25519 key
  },
});

result.attested; // true only if the signature verified
```

### The attested/discount model

- **Attested** (evidence present and the signature verifies): the event counts as a full receipt (weight `1`), and the reputation is keyed by `evidence.publicKey` — in v4 the canonical reputation key is the public key. Free-string addresses remain for unattested/legacy events.
- **Unattested** (no evidence, or verification fails): the event is still accepted and recorded — never hidden — but flagged `attested: false` and weighted at `unattestedWeight` (default `0.25`, configurable on `IdentityRegistryOptions`).
- `receipts`, `canonRate`, and `accuracy` accumulate the event's weight instead of a flat `1`; `attestedReceipts` counts attested events only.
- Optional time decay: set `accuracyHalfLifeMs` to multiply each event's weight by `2^(-(now − timestamp) / accuracyHalfLifeMs)`. Off by default.

`buildEvidencePayload()` and `verifyAttestedEvidence()` are exported so hosts can produce and check signatures with the exact canonical payload the registry verifies.

### Sybil note

New keys start at the `new` level and earn standing only through attested protocol activity. UVRN claims sybil *awareness* — attested events are cryptographically tied to a key, and unattested events are discounted — not sybil *resistance*: nothing stops an actor from generating many fresh keys. Treat low-receipt identities accordingly.

## `IdentityStore` contract

`IdentityStore` is the protocol-facing interface users implement for any backend:

```ts
interface IdentityStore {
  getReputation(address: string): Promise<ReputationScore | null>;
  saveReputation(rep: ReputationScore): Promise<void>;
  recordActivity(activity: ReputationActivity): Promise<void>;
  listLeaderboard(limit: number): Promise<ReputationScore[]>;
}
```

This package does not require Postgres, Supabase, SQLite, Redis, or any specific storage library.

## Built-in store

`MockIdentityStore` is the in-memory local/testing implementation. It provides a zero-external path for unit tests, demos, and package evaluation.

## Reputation formula

v1 score formula:

`(canonRate * 100 * 0.4) + (accuracy * 100 * 0.4) + (volumeScore * 0.2)`

Where:

- `canonRate = canonized receipts / total receipts`
- `accuracy = receipts within 10 points of consensusVScore / total receipts`
- `volumeScore = min(receipts / 100, 1) * 100`

## Levels

- `trusted`: score >= 85 and receipts >= 100
- `established`: score >= 60 and receipts >= 10
- `new`: receipts < 10
- `unknown`: no stored record exists

## Privacy

The registry stores and ranks only protocol facts: receipt count, canon rate, accuracy, and timestamps. It does not aggregate personal metadata.

## Custom store examples

The interface is intentionally backend-agnostic. You can implement it with:

- Postgres
- Supabase
- SQLite
- Redis
- on-chain storage
- any custom store

## Public API

- `IdentityRegistry` (incl. `recordEvent()`)
- `MockIdentityStore`
- `IdentityStore`
- `ReputationScore`
- `ReputationActivity`
- `ReputationLevel`
- `LeaderboardOptions`
- `AttestedEvidence`
- `RecordEventArgs`
- `buildEvidencePayload`
- `verifyAttestedEvidence`
- `SIG_VERSION`

## Dependencies

- Peer dependencies: `@uvrn/core`
- Runtime dependencies: none
