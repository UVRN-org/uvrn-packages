# @uvrn/receipt

The canonical UVRN receipt object model. One module defines what a receipt *is*; every surface —
packages, MCP tools, the uvrn.org portal, `uvrn-worker`, the desktop dashboard — imports it.
UI/UX can be rebuilt at will without touching receipt identity.

**Zero UI dependencies. Zero external runtime dependencies.** Ed25519 via Node `crypto`;
validation is dependency-free (a standard JSON Schema document is exported for ajv users).

Implements `SPEC/uvrn-receipt-v1.md` and `SPEC/uvrn-signing-v1.md` (this monorepo). Conformance
is proven against the golden vectors in `SPEC/vectors/`.

## What's inside

| Module | Exports |
|---|---|
| `types/` | `NetworkReceipt` envelope, `Topic`, `ReceiptSignature`, `HumanView` |
| `canonical/` | `canonicalize()` delegates to core's strict `canonical-serialize-2`; `assembleHashInput()`, `assembleLegacyHashInput()` (also importable as `@uvrn/receipt/canonical`; canonical path is environment-pure with no Node APIs) |
| `schema/` | `NETWORK_RECEIPT_SCHEMA` (JSON Schema) + dep-free `validateNetworkReceipt()` |
| `sign/` | `generateReceiptKeyPair()`, `signReceipt()`, `verifySignature()`, `verifyReceiptFull()`, `computeNetworkReceiptHash()` |
| `topics/` | starter taxonomy (`markets`, `products`, `news`, `research`, `claims` + open `custom/*`), `normalizeTopic()` — normalizes, never rejects |
| `identity/` | `canonicalClaimId()`, `normalizeClaimText()`, `normalizeClaimDomain()` — additive cross-run identity per D9 (also importable as `@uvrn/receipt/identity`) |
| `vocabulary/` | the Layer D human language: verdict map, framing profiles, `WHY_DIVERGENCE_WINS`, score plain-meanings, `buildMasterNarrative()` (also `@uvrn/receipt/vocabulary`) |
| `envelope/` | `wrapDeltaReceipt()`, `wrapMasterReceipt()`, `claimIdFromText()` |
| `render/` | `toHumanView()` — structured, UI-agnostic human representation |

## Quickstart

```ts
import { hashReceipt, verifyReceipt } from '@uvrn/core';
import {
  wrapDeltaReceipt, signReceipt, verifyReceiptFull,
  generateReceiptKeyPair, toHumanView,
} from '@uvrn/receipt';

// 1. An existing v3 DeltaReceipt stays untouched and independently verifiable.
const delta = /* DeltaReceipt from the engine */;

// 2. Wrap it in the network envelope (hash covers the declared field list — additive-safe).
const receipt = wrapDeltaReceipt(delta, {
  claim: 'BTC traded above 100k on 2026-06-09',
  source: 'my-host', action: 'delta.consensus',
  topic: 'markets/crypto/BTC',
});

// 3. Sign it (Ed25519). The signature signs the hash; it never changes the hash.
const keys = generateReceiptKeyPair();
const signed = signReceipt(receipt, { privateKey: keys.privateKey, publicKeyRef: 'my-pk-2026-v1' });

// 4. Verify: integrity + signature. Honest vocabulary — integrity alone is
//    "integrity-checked"; only the signed + recomputable path is "verified".
const result = verifyReceiptFull(signed, { keys: { 'my-pk-2026-v1': keys.publicKey } });
// → { verified: true, integrityOk: true, signatureOk: true, signed: true }

// 5. Render for humans — any UI (React, CLI, plain HTML) can present this.
const view = toHumanView(signed);
// → { headline, verdictLabel: 'Sources align', verdictTone: 'aligned', sources, gaps, provenance, ... }

// 6. Optional source-quality diagnostics (render-only / non-hashed):
const withQuality = toHumanView(signed, {
  sourceQualityInputs: [
    { id: 'src-a', stanceLabel: 'supports', evidenceScore: 10, credibility: 0.2, stanceConfidence: 0.95, stanceEvidence: 'note' },
  ],
});
// → humanView.sourceQualityDiagnostics + gaps entries when stance/evidence/credibility are weak or inconsistent
```

## Integrity-checked vs signed vs verifiable

- `verifyReceipt()` (`@uvrn/core`) and `computeNetworkReceiptHash()` recompute checksums —
  **integrity-checked**. Tampering is detectable; origin is not proven.
- A receipt with a `signature` whose Ed25519 check passes is **signed**.
- **Verifiable** is reserved for both together: `verifyReceiptFull()` returns
  `verified: true` only when the hash recomputes *and* the signature verifies. An unsigned
  receipt can never be "verified", and this package will not say otherwise.

## Design rules (enforced)

- `payload` is never reshaped per surface; the protocol object travels byte-for-byte.
- Receipt canonicalization imports the browser-safe `@uvrn/core/canonical-serialize-2` subpath;
  sparse holes become JSON `null`, and non-finite numbers reject rather than becoming `null`.
- The hash covers a **declared field list** (`NETWORK_RECEIPT_HASH_FIELDS`); unknown envelope
  fields never break verifiers. Hash-covered additions require a new `schemaVersion`.
- Existing v3 receipts and `verifyReceipt()` stay byte-for-byte valid (additive-only rule).
- Gaps are recorded, not hidden: unavailable sources, missing evidence, and unsigned provenance
  all appear explicitly in `toHumanView()` output.
- Source-quality diagnostics (optional): weak/inconsistent `stanceLabel` / `evidenceScore` /
  `credibility` surface on `humanView.sourceQualityDiagnostics` (and mirrored into `gaps`).
  Inputs may be passed via `toHumanView` options or non-hashed `receipt.sourceQualityInputs`
  (unknown-field rule — does not change `receiptHash`).

## Peer dependencies

`@uvrn/core` (types + the frozen v3 hash path). Nothing else.
