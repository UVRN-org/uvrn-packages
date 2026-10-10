# UVRN Signing Specification v1 (`uvrn-signing-v1`)

**Status:** Normative · **Date:** 2026-06-10 · **Generation:** v4 / fable-refactor-1
**Depends on:** `uvrn-receipt-v1.md` (canonicalization §1, hash contracts §2)
**Reference implementation:** `@uvrn/receipt/sign` (Node `crypto`), `uvrn-worker` (WebCrypto)

UVRN uses **one signing story end-to-end: Ed25519** (RFC 8032). Two distinct signatures exist,
making two different statements. They are never interchangeable:

| Signature | Statement | Signer | Lives in |
|---|---|---|---|
| **Producer signature** (`uvrn-sig-1`) | "I produced this receipt" | the system that ran the measurement | `NetworkReceipt.signature` |
| **Registry seal** (`uvrn-seal-1`) | "the network registered this receipt at this time" | the UVRN registry (uvrn-worker) | stored `uvrnSeal` column / API responses |

A receipt MAY carry both, either, or neither. Per the honest-vocabulary rule
(`uvrn-receipt-v1.md` §5), only a receipt whose hash recomputes **and** whose signature verifies
may be called *verifiable*.

(An alternative producer envelope exists at the edges: `@uvrn/adapter`'s EIP-191/ethers path for
Ethereum-keyed producers. It is out of scope for this document and documented in
`uvrn-adapter/README.md`; registries treat it as an opaque payload property.)

---

## 1. Key material

- **Algorithm:** Ed25519 only (`alg: 'ed25519'`).
- **Public key encoding:** base64 of the raw 32-byte public key.
- **Private key encoding:** base64 of the raw 32-byte seed. Implementations using PKCS#8 APIs
  (WebCrypto, Node `crypto`) wrap the seed in the standard 16-byte Ed25519 PKCS#8 prefix
  `302e020100300506032b657004220420`; implementations using SPKI wrap the public key in the
  12-byte prefix `302a300506032b6570032100`.
- **Key reference (`publicKeyRef`):** an opaque string a verifier can resolve to a public key.
  - Registry keys: `uvrn-pk-YYYY-vN` (e.g. `uvrn-pk-2026-v1`) — the existing worker format;
    rotation = publish a new ref, keep old refs resolvable.
  - Producer keys: RECOMMENDED `<org>-pk-YYYY-vN`. Any non-empty string is valid.

### 1.1 Key discovery

Verifiers resolve `publicKeyRef` via the well-known document:

```
GET https://<registry-host>/.well-known/uvrn-keys.json
→ { "keys": [ { "ref": "uvrn-pk-2026-v1", "alg": "ed25519",
                "publicKey": "<base64 raw 32B>", "validFrom"?: ISO8601, "validTo"?: ISO8601 } ] }
```

Producers SHOULD publish the same document shape on a domain they control, or register their
public key with the registry out of band. Resolution order for a verifier: (1) caller-supplied
key map, (2) well-known document of the registry, (3) fail with `KEY_NOT_FOUND` — never silently
skip the check that was requested.

---

## 2. Producer signature (`uvrn-sig-1`)

### 2.1 What is signed

The signature signs the receipt **hash**, not the receipt body (the hash already covers the body
per the declared-field-list contract). The signed payload is this object, canonicalized
(`uvrn-jcs-1`), UTF-8 encoded:

```
SignaturePayload {
  publicKeyRef:  string,
  receiptHash:   string,            // NetworkReceipt.receiptHash ('sha256:<hex>')
  schemaVersion: string,            // the receipt's schemaVersion, e.g. 'uvrn-receipt-4'
  sigVersion:    'uvrn-sig-1',
  signedAt?:     string             // ISO 8601; included iff present in the envelope
}
```

### 2.2 The signature envelope

```
NetworkReceipt.signature = {
  alg:          'ed25519',
  publicKeyRef: string,
  sig:          string,             // base64 of the 64-byte Ed25519 signature
  signedAt?:    string              // ISO 8601
}
```

The envelope is NOT part of the receipt hash (`uvrn-receipt-v1.md` §2.4) — signing is additive
and never invalidates an existing hash.

### 2.3 Signing procedure

1. Compute `receiptHash` per `uvrn-receipt-v1.md` §2.4 (it MUST verify before signing).
2. Assemble `SignaturePayload` (include `signedAt` iff it will be stored in the envelope).
3. `sig = base64( ed25519_sign( privateKey, utf8( canonicalize( SignaturePayload ) ) ) )`.
4. Attach the envelope.

### 2.4 Verification procedure

Given a NetworkReceipt `r` and a resolved public key:

1. **Integrity:** recompute `r.receiptHash` per §2.4 of the receipt spec; mismatch →
   `INTEGRITY_FAILED` (do not proceed).
2. Reassemble `SignaturePayload` from `r.signature.publicKeyRef`, `r.receiptHash`,
   `r.schemaVersion`, `'uvrn-sig-1'`, and `r.signature.signedAt` when present.
3. `ed25519_verify( publicKey, utf8(canonicalize(payload)), base64decode(r.signature.sig) )`.
4. Result: `verified` only when steps 1 and 3 both pass. Report each part separately
   (`integrityOk`, `signatureOk`) — gaps are recorded, not hidden.

Registries MUST verify producer signatures on ingest when present and record the outcome as a
flag (`SIGNATURE_VERIFIED` / `SIGNATURE_INVALID`) — store-and-flag, never silently drop.

---

## 3. Registry seal (`uvrn-seal-1`) — existing, documented

Issued by the registry after it accepts and stores a receipt. The signed payload (canonicalized,
UTF-8):

```
SealPayload {
  receiptHash:   string,
  registryId:    number,            // D1 row id
  certifiedAt:   string,            // = registeredAt
  publicKeyRef:  string,            // 'uvrn-pk-YYYY-vN'
  schemaVersion: string,
  sealVersion:   'uvrn-seal-1'
}
```

Stored/returned envelope:

```
uvrnSeal = { signature: base64, certifiedAt, publicKeyRef, sealVersion: 'uvrn-seal-1' }
```

Verification mirrors §2.4: resolve the registry key from `/.well-known/uvrn-keys.json`,
reassemble `SealPayload` (the verifier must know `registryId` — it is returned by every read
endpoint), canonicalize, verify. The seal asserts registration, **not** truth of the payload.

---

## 4. Future work (recorded, not in scope)

- Production key custody / HSM for the registry private key.
- Transparency-log anchoring of registry roots.
- Key revocation semantics beyond `validTo`.
