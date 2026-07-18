# @uvrn/core

UVRN Delta Engine core — deterministic multi-source comparison and verification. Runs the Delta formula on bundles, produces canonical receipts with SHA-256 hashes, and validates or verifies bundles and receipts.

**Package provides:** `runDeltaEngine`, `validateBundle`, `verifyReceipt`, frozen legacy `canonicalSerialize`, strict `canonicalSerializeV2`, `canonicalSerializeForVersion`, `hashReceipt`, `buildMasterReceipt`, `verifyMasterReceipt`; types (`DeltaBundle`, `DeltaReceipt`, `Measurement`, `MasterReceipt`, etc.). Pure logic — no I/O, no signer, no storage.

**You provide:** Bundle data (claim, threshold, at least two data specs with metrics). No connectors or keys required for basic use.

## Install

```bash
npm install @uvrn/core
```

Or with pnpm:

```bash
pnpm add @uvrn/core
```

## Usage

1. Define a **bundle**: a claim, a threshold, and at least two data specs with metrics.
2. Call `runDeltaEngine(bundle)` to get a **receipt** (outcome, delta, hash).
3. Use `validateBundle` and `verifyReceipt` for validation and integrity checks.

```typescript
import { runDeltaEngine, validateBundle, verifyReceipt } from '@uvrn/core';

const bundle = {
  bundleId: 'example-001',
  claim: 'Metrics from source-a and source-b should agree within 10%.',
  thresholdPct: 0.10,
  dataSpecs: [
    {
      id: 'source-a',
      label: 'Source A',
      sourceKind: 'report',
      originDocIds: ['doc-a-1'],
      metrics: [{ key: 'count', value: 100 }],
    },
    {
      id: 'source-b',
      label: 'Source B',
      sourceKind: 'report',
      originDocIds: ['doc-b-1'],
      metrics: [{ key: 'count', value: 105 }],
    },
  ],
};

const receipt = runDeltaEngine(bundle);
console.log(receipt.outcome);   // 'consensus' | 'indeterminate'
console.log(receipt.deltaFinal); // max delta across metrics
console.log(receipt.hash);      // SHA-256 of canonical receipt
```

## Use cases

- **Compare two or more data sources** — Run the Delta formula on metrics (e.g. report A vs report B) and get a deterministic consensus or indeterminate outcome.
- **Produce verifiable receipts** — Every receipt has a canonical hash; use `verifyReceipt(receipt)` to recompute and check integrity.
- **Validate before running** — Use `validateBundle(bundle)` to check structure and threshold without executing the engine.
- **Integrate into pipelines** — Use as a library in CI, ETL, or any service that needs deterministic comparison and proof.

## Measurement contract

`@uvrn/core` exports the shared `Measurement` contract types so hosts and packages can describe relationship checks over evidence in one stable shape. Core owns the type boundary only: it does not run agree/disagree/conflict/potential logic, register measurement modules, fetch sources, or store results.

Measurement implementations live in packages such as `@uvrn/measure` or in host applications. A custom measurement implements `Measurement.evaluate(input)` and returns a `MeasurementResult` with a short factual explanation and evidence references.

## Master receipt

`MasterReceipt` is an additive envelope over an existing `DeltaReceipt`. It records the base receipt, measurement results, and node status records for every participating source or node. A node that is `off` or `unavailable` is recorded directly in `nodes[]`; missing capacity is not hidden.

`buildMasterReceipt()` computes a separate `masterHash` from the envelope version, claim, `base.hash`, measurements, nodes, and timestamp. The full base receipt does not enter the master hash, and `hashReceipt()` / `verifyReceipt()` behavior for existing `DeltaReceipt` values is unchanged.

`verifyMasterReceipt()` delegates base verification to `verifyReceipt(base)` and then recomputes the additive master hash.

## Canonicalization versions

`canonicalSerialize` is the byte-frozen `canonical-serialize-1` verifier path. It remains
importable for historical artifacts but must not be used by new producers. Strict
`canonical-serialize-2` is the one live implementation:

```ts
import {
  CANONICAL_SERIALIZATION_V2,
  canonicalSerializeV2,
} from '@uvrn/core/canonical-serialize-2';

const bytes = canonicalSerializeV2({ b: 2, a: 1 });
// {"a":1,"b":2}
```

The browser/worker-safe subpath above has no crypto or Node imports. V2 omits undefined object
members, converts dense undefined array elements and true sparse holes to JSON `null`, and throws
a typed `CanonicalSerializationError` for top-level undefined, non-finite numbers, functions,
symbols, bigint values, and non-plain objects.

Artifacts that carry a discriminator can use `canonicalSerializeForVersion(version, value)`.
Unknown versions throw `UnsupportedCanonicalSerializationVersionError`; verifiers never guess or
fall back.

### Migration table

| Artifact / caller | Declared selector | Serializer | Phase B rule |
|---|---|---|---|
| Historical core / DeltaReceipt path | `canonical-serialize-1` (legacy contract) | frozen `canonicalSerialize` | verify only; bytes unchanged |
| Existing canon artifacts without a discriminator | implicit historical v1 | frozen `canonicalSerialize` | verify only; do not reinterpret |
| New or explicitly migrated canonical producers | `canonical-serialize-2` | `canonicalSerializeV2` | producer must persist the discriminator |
| `@uvrn/receipt` canonical hash path | package contract selects v2 | shared `canonicalSerializeV2` | receipt schema/seal unchanged |
| `@uvrn/identity` `uvrn-sig-1` evidence payload | identity package contract selects v2 | shared `canonicalSerializeV2` | valid-JSON signed bytes unchanged |
| Unknown discriminator | any other string | none | reject |

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-core`)
- [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) — programmatic client (CLI/HTTP/local) built on this core
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line
