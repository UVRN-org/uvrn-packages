# UVRN Receipt Specification v1 (`uvrn-receipt-v1`)

**Status:** Normative · **Date:** 2026-06-10 · **Generation:** v4 / fable-refactor-1
**Implements:** `admin/plans/01-PACKAGE-REFACTOR.md` §A1, `02-RECEIPT-OBJECT-MODEL.md` §B2/B5
**Reference implementation:** `@uvrn/receipt` (this monorepo)

This document defines what a UVRN receipt *is*, independent of any implementation: the object
shapes, the canonicalization algorithm, and the **exact hash payload contract** for every receipt
hash in the ecosystem. Any implementation in any language that follows this document will produce
and verify byte-identical hashes.

The words MUST, MUST NOT, SHOULD, and MAY are used in the RFC 2119 sense.

---

## 1. Canonicalization (`uvrn-jcs-1`)

All UVRN hashes and signatures are computed over a canonical JSON serialization.

**The canonical form is RFC 8785 (JSON Canonicalization Scheme, JCS):**

1. Object members are sorted by key, lexicographically by UTF-16 code units.
2. No insignificant whitespace.
3. Strings are serialized per JSON (RFC 8259) with the JCS escaping rules — this is exactly what
   ECMAScript `JSON.stringify` produces.
4. Numbers are serialized per ECMAScript Number-to-string (shortest round-trip form). `NaN` and
   `Infinity` MUST NOT appear in any hashed payload.
5. Object members whose value is `undefined` (a non-JSON value) MUST be omitted before
   serialization. `undefined` array elements MUST be serialized as `null`.

Interoperable implementations: the npm `json-canonicalize` package (used by `uvrn-worker` and the
uvrn.org site today) and `@uvrn/receipt`'s `canonicalize()` produce identical output for all JSON
values. `@uvrn/core`'s `canonicalSerialize()` (frozen v3 code) also produces identical output for
all JSON-representable values; its divergent handling of `undefined` members (malformed output
rather than omission) is a known wart that cannot occur for receipts that round-trip through JSON.
New code MUST use `@uvrn/receipt`'s `canonicalize()`.

**Hash function:** SHA-256 over the UTF-8 encoding of the canonical string.

Two hash *encodings* exist for historical reasons and are both retained:

| Encoding | Form | Used by |
|---|---|---|
| `hex` | 64 lowercase hex chars, no prefix | `DeltaReceipt.hash`, `MasterReceipt.masterHash` |
| `prefixed` | `sha256:` + 64 lowercase hex chars | `NetworkReceipt.receiptHash`, worker registry |

---

## 2. Hash payload contracts (the registry of every UVRN hash)

The single rule that makes additive evolution safe: **every hash covers a declared field list,
never "all fields."** A verifier assembles the hash input from the declared list only and ignores
any other fields present on the object. Adding a new optional field to an envelope therefore never
breaks an existing hash. The two frozen v3 hashes (§2.1, §2.3) predate this rule and are
closed-world; they are frozen and MUST NOT gain fields.

### 2.1 `drvc3-delta-1` — `DeltaReceipt.hash` (FROZEN, v3 protocol law)

- **Encoding:** `hex`
- **Payload:** the DeltaReceipt object with the `hash` member removed. Concretely, the closed
  field set: `bundleId`, `deltaFinal`, `sources`, `rounds`, `suggestedFixes`, `outcome`, and `ts`
  when present.
- **Rule:** closed-world. The DeltaReceipt shape is frozen v3 protocol law; fields MUST NOT be
  added to it. New capability wraps it (MasterReceipt, NetworkReceipt) — it is never reshaped.
- **Verifier:** `@uvrn/core` `verifyReceipt()` — unchanged in v4, byte-for-byte compatible with
  every existing v3 receipt.

### 2.2 `uvrn-master-1` — `MasterReceipt.masterHash`

- **Encoding:** `hex`
- **Payload:** exactly this object, canonicalized:

```
{
  envelopeVersion: number,        // 1
  claim: string,
  baseHash: string,               // = base.hash (the base DeltaReceipt participates ONLY via its hash)
  measurements: MeasurementResult[],
  nodes: NodeStatusRecord[],
  ts: string                      // ISO 8601
}
```

- **Ordering (normative, closes the 2026-06-04 audit blocker):** producers MUST emit
  `measurements` sorted ascending by (`type`, then first `evidenceRefs` entry or `''`, then
  original insertion index) and `nodes` sorted ascending by `id` **before** hashing, and MUST
  store the arrays in that same order. Verifiers MUST recompute over the arrays **as stored**
  (they MUST NOT re-sort) — so master receipts produced before this rule remain valid.
- **Field exactness:** every member of each `MeasurementResult` (`type`, `verdict`, `confidence`,
  `explanation`, `evidenceRefs`, and any additive optional members present, e.g.
  `humanExplanation`) and each `NodeStatusRecord` (`id`, `status`, and `detail`/`observedAt` when
  present) is hashed. Optional members absent from the object are absent from the hash input.

### 2.3 `drvc3-receipt-1` — worker registry hash (FROZEN, live network law)

- **Encoding:** `prefixed`
- **Payload:** assembled in this declared list; optional members included only when present:

```
schemaVersion, source, action, payload, occurredAt, sdk,        // required
tags?, receiptType?, narrative?, links?, chainId?               // optional, when present
```

  where `sdk = { name, version, integrityHash }`.
- This is the live `uvrn-worker` ingest contract. It is frozen: existing stored receipts and
  `drvc3-receipt-1` submissions MUST continue to verify byte-identically forever.

### 2.4 `uvrn-receipt-4` — `NetworkReceipt.receiptHash` (NEW in v4)

- **Encoding:** `prefixed`
- **Payload:** assembled in this declared list; optional members included only when present:

```
schemaVersion,            // 'uvrn-receipt-4'  (required)
kind,                     // required
claim,                    // required: { id, text }
source, action, occurredAt, payload,    // required
topic?, tags?, narrative?, links?, chainId?, sdk?   // optional, when present
```

- **Unknown-field rule (normative):** the hash covers exactly the list above. Any other member of
  the envelope — including `signature`, `receiptHash` itself, registry-assigned fields
  (`registryId`, `registeredAt`, `uvrnSeal`, `flags`, `vScore`, `typeConfidence`), and any field
  added by a future minor revision — is NOT hashed and MUST be ignored by hash verifiers.
  Hash-covered additions require a new `schemaVersion`.
- `signature` cannot be hashed because it signs the hash (see `uvrn-signing-v1.md`).

---

## 3. The NetworkReceipt envelope (`schemaVersion: 'uvrn-receipt-4'`)

The NetworkReceipt is the one receipt object every UVRN surface consumes — packages, MCP tools,
the uvrn.org portal, `uvrn-worker`, and the desktop dashboard. It is an **additive wrapper**: the
protocol object (`payload`) is never reshaped per surface.

```
NetworkReceipt {
  schemaVersion: 'uvrn-receipt-4'
  receiptHash:   string                  // 'sha256:<64 hex>' per §2.4
  kind:          'delta' | 'master' | 'drift' | 'canon' | 'parity' | 'analytics' | 'genesis'
  claim:         { id: string, text: string }
  source:        string                  // producing system, e.g. 'uvrn-sdk'
  action:        string                  // event name, e.g. 'delta.consensus'
  occurredAt:    string                  // ISO 8601 UTC
  payload:       object                  // the protocol object, untouched:
                                         //   kind='delta'  → DeltaReceipt
                                         //   kind='master' → MasterReceipt
                                         //   kind='drift'  → AgentDriftReceipt
                                         //   others        → producer-defined object
  topic?:        string                  // serialized Topic, §4
  tags?:         string[]
  narrative?:    string                  // ≤500 chars; REQUIRED when kind='master'
  links?:        { hash, rel, label? }[] // rel ∈ follows|caused-by|references|part-of|responds-to
  chainId?:      string                  // ≤128 chars
  sdk?:          { name, version, integrityHash }
  signature?:    { alg: 'ed25519', publicKeyRef: string, sig: string, signedAt?: string }
}
```

Validation rules (enforced by the `@uvrn/receipt` JSON Schema and by the worker on ingest):

1. `claim.id` MUST be a non-empty string, stable across receipts for the same claim
   (recommended: slug + 8-char SHA-256 suffix, the `@uvrn/mcp` convention).
2. `narrative` MUST be present and non-empty when `kind = 'master'`; always ≤500 characters.
   It MUST be written in the human vocabulary (see `02`/Layer D), e.g. "7 of 8 sources align;
   1 was unreachable."
3. `links` ≤50 entries; each `hash` matches `/^sha256:[0-9a-f]{64}$/`; `label` ≤256 chars.
4. `occurredAt` MUST be valid ISO 8601. `registeredAt` is registry-assigned, never producer-set.
5. Consumers MUST ignore unknown envelope members (forward compatibility).
6. `kind` supersedes the legacy worker `receiptType` (`genesis`/`parity`/`analytics` carry over
   as kinds). Registries MAY dual-store during transition.

**Compatibility:** registries MUST continue to accept `drvc3-receipt-1` submissions unchanged.
`uvrn-receipt-4` is additive alongside it, not a replacement.

### 3.1 Wrapping a v3 DeltaReceipt (worked contract)

Given an existing, verified v3 `DeltaReceipt d`:

```
wrap = {
  schemaVersion: 'uvrn-receipt-4',
  kind: 'delta',
  claim: { id: <stable claim id>, text: <claim text> },
  source, action, occurredAt: d.ts ?? <caller-supplied>,
  payload: d,                              // byte-for-byte, including d.hash
  ...optional fields
}
wrap.receiptHash = prefixedSha256(canonicalize(hashInput(wrap)))    // §2.4
```

`d` remains independently verifiable via `verifyReceipt(d)` at all times. Wrapping MUST NOT
mutate the payload.

---

## 4. Topic serialization

A Topic is structurally `{ domain, subject?, instrument? }` and is **serialized to a single
string** for the envelope, hash, registry column, and URLs:

```
domain[/subject[/instrument]]      e.g. 'markets/crypto/BTC', 'products/pod/brooch-aesthetic'
```

- Segments are lowercase `[a-z0-9-]+` except `instrument`, which MAY contain uppercase
  (ticker convention).
- Starter domains (controlled, D-4): `markets`, `products`, `news`, `research`, `claims`.
- The vocabulary is open: unknown domains MUST be accepted under `custom/<domain>[/...]` —
  recorded, not hidden, never rejected. Validators normalize, they do not refuse.
- Free-form `tags[]` remain available for cross-cutting labels.

---

## 5. Honest-vocabulary requirements (normative for docs and UI copy)

| Term | May be used when |
|---|---|
| **integrity-checked** | a hash in §2 recomputes correctly (checksum — detects tampering, proves nothing about origin) |
| **signed** | a producer `signature` or registry `uvrnSeal` verifies per `uvrn-signing-v1.md` |
| **verifiable** | reserved for the signed **and** recomputable path (integrity + signature both pass) |

`verifyReceipt()` / `verifyMasterReceipt()` are integrity checks. `verifyReceiptFull()` in
`@uvrn/receipt` is the verification path. Copy that calls a bare checksum "verified" violates
this spec.

---

## 6. Golden vectors

`SPEC/vectors/` contains the conformance fixtures (consumed by `@uvrn/receipt` tests and intended
for any future non-TypeScript implementation):

- `canonical.json` — value → canonical string → `hex` SHA-256 cases, including key-ordering,
  unicode, number-form, and undefined-omission edge cases.
- `network-receipt.json` — a complete `uvrn-receipt-4` NetworkReceipt wrapping a v3 DeltaReceipt:
  fixed Ed25519 keypair, expected `receiptHash`, expected `sig`, plus tampered-variant cases that
  MUST fail (hash mismatch, signature mismatch).
- `master-receipt.json` — a MasterReceipt with expected `masterHash` and expected
  `toHumanView()` output.

An implementation is conformant when it reproduces every vector.
