# Security Policy

UVRN is a verification protocol — its hashing and signing guarantees are the product.
We take reports against them seriously.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via [GitHub Security Advisories](https://github.com/UVRN-org/uvrn-packages/security/advisories/new)
("Report a vulnerability" on the repo's Security tab).

Include: affected package(s) and version, a reproduction or proof of concept, and the
impact as you understand it (e.g. hash collision path, signature bypass, canonicalization
divergence between implementations).

## Scope

Highest-priority surfaces:

- `@uvrn/receipt` — JCS canonicalization, `uvrn-receipt-4` hash assembly, Ed25519
  signing/verification (`SPEC/uvrn-receipt-v1.md`, `SPEC/uvrn-signing-v1.md`)
- The frozen legacy `drvc3-receipt-1` hash contract
- The golden test vectors in `SPEC/` (a vector that passes when it shouldn't is a bug)

## What to expect

We will acknowledge receipt, investigate, and coordinate a fix and disclosure timeline
with you. Honest vocabulary applies to our responses too: we will tell you exactly what
is and is not affected.
