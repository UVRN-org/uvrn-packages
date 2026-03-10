# @uvrn/adapter

UVRN DRVC3 envelope adapter — wraps Delta Engine receipts in DRVC3 envelopes with EIP-191 signatures. Use this when you need to attach issuer identity and signing to core receipts without changing their deterministic hash.

## Install

```bash
npm install @uvrn/adapter
```

Or with pnpm:

```bash
pnpm add @uvrn/adapter
```

Requires `@uvrn/core` (peer). Install the core if you do not have it:

```bash
npm install @uvrn/core @uvrn/adapter
```

## Usage

1. Obtain a **DeltaReceipt** from `@uvrn/core` (e.g. `runDeltaEngine(bundle)`).
2. Use **wrapInDRVC3** with an ethers signer and options to produce a DRVC3 envelope.
3. Use **validateDRVC3** / **extractDeltaReceipt** to validate envelopes and read back the core receipt.

```typescript
import { runDeltaEngine } from '@uvrn/core';
import { wrapInDRVC3, validateDRVC3, extractDeltaReceipt } from '@uvrn/adapter';
import { Wallet } from 'ethers';

const bundle = { /* ... DeltaBundle ... */ };
const receipt = runDeltaEngine(bundle);

const wallet = new Wallet(process.env.SIGNER_PRIVATE_KEY);
const drvc3 = await wrapInDRVC3(receipt, wallet, {
  issuer: 'my-service',
  event: 'delta-reconciliation',
});

const valid = validateDRVC3(drvc3);
const extracted = extractDeltaReceipt(drvc3);
```

## Use cases

- **Sign receipts with a known identity** — Attach EIP-191 signatures so consumers can verify who issued the envelope.
- **Interop with DRVC3 systems** — Produce standard DRVC3 envelopes that other tools can validate and parse.
- **Audit and provenance** — Keep the core receipt hash unchanged while adding issuer and timestamp in the envelope.

## Links

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-adapter`)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core (produces the receipts this adapter wraps)
