# @uvrn/protocol

The single-install UVRN common path. One dependency gives you the whole
claim → measurement → master receipt → signed network receipt flow:
`@uvrn/core` + `@uvrn/receipt` + `@uvrn/measure` + `@uvrn/consensus` + `@uvrn/score` +
`@uvrn/signal`, re-exported.

Install the individual packages instead when you want a smaller surface — everything here is
also published separately. This package adds no logic of its own.

## The 10-line quickstart: claim → signed MasterReceipt

```ts
import { runDeltaEngine, buildMasterReceipt, agreeMeasurement, enrichMeasurements,
         wrapMasterReceipt, signReceipt, verifyReceiptFull, generateReceiptKeyPair } from '@uvrn/protocol';

const claim = 'BTC traded above 100k on 2026-06-09';
const base = runDeltaEngine({ bundleId: 'demo-1', claim, thresholdPct: 0.05, dataSpecs: [/* your evidence */] });
const measurements = enrichMeasurements([agreeMeasurement.evaluate({ claim, sources: [/* evidence */] })]);
const master = buildMasterReceipt({ base, claim, measurements, nodes: [/* source roster */] });
const keys = generateReceiptKeyPair();
const signed = signReceipt(wrapMasterReceipt(master, { claim, source: 'my-host', action: 'master.measured' }),
                           { privateKey: keys.privateKey, publicKeyRef: 'my-pk-2026-v1' });
verifyReceiptFull(signed, { keys: { 'my-pk-2026-v1': keys.publicKey } }); // → { verified: true, ... }
```

This exact flow runs in `tests/quickstart.test.ts`.

## Shape

- **Flat exports** — the quickstart names above plus `toHumanView`, `verifyReceipt`,
  `verifyMasterReceipt`, `VSCORE_WEIGHTS`, `ConsensusEngine`, the four starter measurements,
  and the common types.
- **Namespaced exports** — `core`, `receipt`, `measure`, `consensus`, `score`, `signal` for
  everything else (`import { receipt } from '@uvrn/protocol'; receipt.canonicalize(...)`).

## Honest vocabulary

`verifyReceipt`/`verifyMasterReceipt` are integrity checks (checksums). Only
`verifyReceiptFull` — hash recompute **and** Ed25519 signature — earns the word *verified*.
