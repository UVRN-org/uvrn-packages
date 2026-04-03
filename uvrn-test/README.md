# @uvrn/test

`@uvrn/test` is the shared development-time toolkit for UVRN packages. It provides factories, fixtures, and in-memory mocks so packages can test receipt flows, drift snapshots, canon storage, and farm connectors without provisioning external services.

## Install (dev only)

```bash
npm install --save-dev @uvrn/test @uvrn/core
```

`@uvrn/drift` and `@uvrn/canon` are optional peer dependencies. Install them when the package under test uses those surfaces.

`@uvrn/test` is a development-only package. Do not add it as a runtime dependency.

## Usage

```ts
import {
  MockFarmConnector,
  MockSigner,
  MockStore,
  fixtures,
  mockCanonReceipt,
  mockReceipt,
} from '@uvrn/test';

const receipt = mockReceipt({ v_score: 88, status: 'STABLE' });
const canonReceipt = mockCanonReceipt({ claim_id: 'clm_001' });

const farm = new MockFarmConnector({ latencyMs: 25 });
const result = await farm.fetch('clm_001');

const store = new MockStore();
await store.save(canonReceipt);

const signer = new MockSigner({ address: '0xABC123' });
const signed = await signer.sign(receipt);

console.log(result.claimId, signed.signature, fixtures.stableReceipt.v_score);
```

## Factory functions

- `mockReceipt(overrides?)`
- `mockDriftSnapshot(overrides?)`
- `mockAgentDriftReceipt(overrides?)`
- `mockCanonReceipt(overrides?)`
- `mockFarmResult(overrides?)`

Each factory accepts `Partial<T>` overrides so tests only specify the fields they care about.

## Mock classes

### `MockFarmConnector`

Reference implementation of the current `@uvrn/agent` `FarmConnector` shape. It supports the actual `ClaimRegistration` input and a plain string shorthand for tests.

### `MockStore`

In-memory canon receipt store. It exposes ergonomic test helpers (`save`, `get`, `list`) and also satisfies the current `CanonStore` interface (`write`, `read`, `exists`).

### `MockSigner`

Small signer utility for tests. It returns signed envelopes for general receipt tests and supports canon-style `sign`, `verify`, and `verifyWithPublicKey` methods.

## Fixtures

- `fixtures.claimId`
- `fixtures.stableReceipt`
- `fixtures.driftingReceipt`
- `fixtures.criticalReceipt`

These provide ready-made baseline states for unit tests and examples.

## Public API

- `mockReceipt`
- `mockDriftSnapshot`
- `mockAgentDriftReceipt`
- `mockCanonReceipt`
- `mockFarmResult`
- `MockFarmConnector`
- `MockStore`
- `MockSigner`
- `fixtures`
- `UVRNReceipt`
- `UVRNReceiptSource`
- `MockFarmConnectorOptions`
- `MockSignerOptions`
- `MockSignedEnvelope`

## Dependencies

- Peer dependencies: `@uvrn/core`, `@uvrn/drift` (optional), `@uvrn/canon` (optional)
- Runtime dependencies: none
