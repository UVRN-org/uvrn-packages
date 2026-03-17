# @uvrn/core

UVRN Delta Engine core — deterministic multi-source comparison and verification. Runs the Delta formula on bundles, produces canonical receipts with SHA-256 hashes, and validates or verifies bundles and receipts.

**Disclaimer:** UVRN is in Alpha testing. The engine measures whether your sources agree with each other — not whether they’re correct. Final trust of output rests with the user. Use at your own risk. Have fun.

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

- **Compare two or more data sources** — Run the Delta formula on metrics (e.g. report A vs report B) and get a deterministic consensus or indeterminate outcome. Note: consensus means the sources agree with each other within the threshold — not that either source is correct.
- **Produce verifiable receipts** — Every receipt has a canonical hash; use `verifyReceipt(receipt)` to recompute and check integrity.
- **Validate before running** — Use `validateBundle(bundle)` to check structure and threshold without executing the engine.
- **Integrate into pipelines** — Use as a library in CI, ETL, or any service that needs deterministic comparison and proof.

### Use case: Product / content research

Your audience and market data often live in multiple places: platform analytics (e.g. YouTube, Spotify), surveys, CRM exports, or APIs. When one source says +41%, another +35%, and a third +38%, it’s hard to know if you can safely pivot or ship — **who do you trust?**

UVRN helps **content creators, product teams, and designers** reconcile that split. You feed **2 to 100+ data sources** into the Delta Engine (each with comparable metrics). The engine:

1. **Canonically serializes** the inputs, runs a **deterministic delta comparison**, and checks whether the spread is within your **threshold** (e.g. 8%).
2. Produces a **verifiable receipt** with a clear outcome: **consensus** (sources agree within threshold — e.g. “Both signals agree. Pivot with proof.”) or **indeterminate** (outside threshold — time to investigate).
3. The receipt is **hash-verified** and **reproducible**; you can share it with partners or your team so anyone can verify the same result.

**Example:** Three sources — YouTube Analytics (+41% how-to views), a subscriber survey (+35% demand), and a platform API (+38% engagement). The engine returns **consensus** with a 4.83% delta (within an 8% threshold), so the designer or creator can confidently decide to pivot or ship, backed by a receipt — not just a hunch.

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-core`)
- [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) — programmatic client (CLI/HTTP/local) built on this core
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line
