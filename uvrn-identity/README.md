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

- `IdentityRegistry`
- `MockIdentityStore`
- `IdentityStore`
- `ReputationScore`
- `ReputationActivity`
- `ReputationLevel`
- `LeaderboardOptions`

## Dependencies

- Peer dependencies: `@uvrn/core`
- Runtime dependencies: none
