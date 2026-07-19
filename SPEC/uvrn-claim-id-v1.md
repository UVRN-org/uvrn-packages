# UVRN Claim Identity and Run Identifier Specification v1 (`uvrn-claim-id-v1`)

**Status:** Proposed normative contract · **Date:** 2026-07-19 · **Generation:** v4 additive extension  
**Companion specs:** `uvrn-receipt-v1.md` · `uvrn-signing-v1.md`  
**Decisions:** D2, D9, D13 · **Architecture:** ADR-006, ADR-010

This specification separates per-run claim references from cross-run claim identity and defines
the grammar for newly minted run identifiers. The words MUST, MUST NOT, SHOULD, and MAY are used
in the RFC 2119 sense.

---

## 1. Two identities, named apart

- **`runClaimId`** is an existing producer-owned identifier for a claim inside one run. Its
  derivation and existing serialized fields remain unchanged.
- **`canonicalClaimId`** is the deterministic cross-run identity defined by §2. It groups entries
  about the same normalized claim and optional domain.

A producer MUST NOT call either value merely `claimId` at a boundary where both meanings are
possible. Existing fields named `claimId` are not renamed by this additive specification; adapters
MUST explicitly map each legacy field to `runClaimId` or `canonicalClaimId`.

`canonicalClaimId` MAY be carried only in an additive, non-frozen field. It MUST NOT be added to
an existing receipt hash field list, signature payload, or frozen no-stance surface (D2,
ADR-010).

---

## 2. Canonical claim identity

The derivation is:

```text
normalizedClaimText = normalize(claimText)
normalizedDomain    = domain is absent or empty ? "" : normalize(domain)
payload             = canonicalize({
                        claimText: normalizedClaimText,
                        domain: normalizedDomain
                      })
digest              = lowercase_hex(sha256(utf8(payload)))
canonicalClaimId    = "claim:" + first_12_hex_characters(digest)
```

`canonicalize` above is the shared `@uvrn/receipt` canonicalizer. Implementations MUST NOT
substitute object insertion order, locale collation, or a new serializer (ADR-006).

An empty `normalizedClaimText` is invalid and MUST be rejected. An absent, `null`, or empty domain
normalizes to the empty string and remains part of the canonical payload.

### 2.1 Locked normalization order

For claim text and a supplied non-empty domain, implementations MUST apply these steps exactly:

1. require a string;
2. apply Unicode Normalization Form Compatibility Composition (`NFKC`);
3. remove leading and trailing ECMAScript whitespace;
4. apply Unicode-aware, locale-independent lowercase conversion equivalent to JavaScript
   `String.prototype.toLowerCase()`;
5. replace each non-empty run matching Unicode general category `P` (all punctuation) with one
   U+0020 SPACE;
6. collapse each run of ECMAScript whitespace (`\s`) to one U+0020 SPACE;
7. remove leading and trailing whitespace again.

Symbols (Unicode category `S`), letters, numbers, and combining marks are retained. This means
punctuation, case, whitespace, and canonically equivalent composed/decomposed Unicode variants
converge while materially different claim text or domains remain distinct.

### 2.2 Encoding

The identifier MUST match `^claim:[0-9a-f]{12}$`. The 12 hexadecimal characters are a compact
reference, not a signature or proof of origin. Collision-sensitive storage SHOULD retain the
normalized claim text and domain and MUST detect a conflicting reuse rather than silently merge it.

### 2.3 Conformance vectors

`SPEC/vectors/claim-identity.json` is normative. It covers stable derivation, case/whitespace/
punctuation equivalence, NFKC equivalence, different claims, and domain separation.

---

## 3. Run identifier grammar

New run identifiers MUST match:

```text
<domain-prefix>-<suffix>
domain-prefix = lowercase alphanumeric token, optionally containing internal hyphens
suffix        = three decimal digits | shortid
shortid       = 6..32 lowercase ASCII letters, decimal digits, or hyphens
```

The complete grammar is `^[a-z0-9]+(?:-[a-z0-9]+)*-(?:[0-9]{3}|[a-z0-9][a-z0-9-]{5,31})$`.
Identifiers MUST be unique within the issuing host's retention boundary.

### 3.1 Registered existing forms

| Form | Registered owner / meaning |
|---|---|
| `run-<NNN>` | Generic or legacy package run |
| `pod-<NNN>` | POD domain run |
| `dash-<NNN>` | Dash v1 run |
| `dash2-run-<shortid>` | Dash v2 run |

These registrations document existing forms; they do not require migration of stored identifiers.

### 3.2 Coining a new domain prefix

A producer that needs a new prefix MUST:

1. search this specification's registered forms and host contracts for an existing owner;
2. choose the shortest descriptive lowercase token, using internal hyphens only when needed;
3. avoid `run`, `pod`, `dash`, `dash2-run`, and any prefix already owned by another domain;
4. register the prefix, owner, and collision boundary in the applicable SPEC or `02-contracts/`
   file before emitting it;
5. use one suffix strategy consistently for that producer.

Prefix aliases, environment names, and version numbers MUST NOT create parallel identities for
the same run.

### 3.3 Fallback identifiers

A human-readable fallback MUST have this form:

```text
run-YYYYMMDD-<shortid>
```

`YYYYMMDD` is the UTC calendar date and `<shortid>` is 6..16 lowercase ASCII letters or digits.
Opaque epoch-millisecond fallbacks such as `run-${Date.now()}` MUST NOT be introduced. Existing
stored fallback IDs remain valid legacy data. Site adoption of this fallback is assigned to BP-03
or WS-ADOPT-001 and is not executed by BP-08.
