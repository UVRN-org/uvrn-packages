# @uvrn/adapter

UVRN DRVC3 envelope adapter — wraps Delta Engine receipts in DRVC3 envelopes with EIP-191 signatures. Use this when you need to attach issuer identity and signing to core receipts without changing their deterministic hash.

**Disclaimer:** UVRN is in Alpha testing. The engine measures whether your sources agree with each other — not whether they’re correct. Final trust of output rests with the user. Use at your own risk. Have fun.

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

## DRVC3 customization

### What you can customize

You can set these options when wrapping a receipt (no code changes to this package):

- **issuer** — Your service or org name (e.g. `'my-app'`, `'acme-corp'`).
- **event** — Event type (e.g. `'delta-reconciliation'`, `'price-attestation'`).
- **certificate** — Version or brand string (default `'DRVC3 v1.01'`; you can use e.g. `'MyCorp Receipt v1'`).
- **description**, **resource**, **replay_instructions**, **tags** — Optional metadata.
- **extensions** — Arbitrary key-value object for your own metadata (provenance, evidence links, etc.).

Example:

```typescript
const drvc3 = await wrapInDRVC3(receipt, wallet, {
  issuer: 'acme-corp',
  event: 'price-attestation',
  certificate: 'Acme Receipt v1',
  extensions: { source: 'https://acme.com/feed', region: 'us-east' },
});
```

### What is fixed

The envelope **structure** is defined by the bundled DRVC3 schema (`schemas/drvc3.schema.json`). Required fields (e.g. `receipt_id`, `issuer`, `event`, `timestamp`, `integrity`, `block_state`, `certificate`, `validation.checks.delta_receipt`) cannot be changed when using `validateDRVC3`. There is no option to pass a different schema.

### Using a different envelope format

If you need a completely different envelope spec:

- **Fork this package** — Change the types, schema, wrapper, and validator in your own package and publish under your own scope.
- **Skip DRVC3** — Use `@uvrn/core` (and optionally `@uvrn/sdk`) only; build your own envelope format and signing/validation on top of the core receipt.

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-adapter`)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core (produces the receipts this adapter wraps)
