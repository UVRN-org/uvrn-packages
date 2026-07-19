# Data shapes — reference-spine hygiene

**Status:** Contract notation for BP-08
**Normative source:** `SPEC/uvrn-claim-id-v1.md`

## Reference-spine hygiene (BP-08)

### Claim identity names

At seams where both meanings can occur, adapters use `runClaimId` for the existing per-run
protocol reference and `canonicalClaimId` for the cross-run value from
`@uvrn/receipt` (`SPEC/uvrn-claim-id-v1.md`, D9). A bare `claimId` is legacy input that MUST be
mapped explicitly; it is not enough information to merge identities. Additive carriage MUST NOT
change a frozen receipt hash field list (ADR-010).

### `protocolVersion` single source on the next site touch

The site package loader currently derives `uvrn-packages@<version>` while a dash route also
re-derives or restamps that reference. When BP-03 or a later site unit next changes those files,
the loader boundary MUST own the derivation from the resolved `@uvrn/receipt` package generation
and expose the resulting `protocolVersion` capability. Dash routes and adapters MUST consume that
capability unchanged; they MUST NOT read package metadata or format the version independently.

This is a recorded cross-repo adoption rule only. BP-08 does not edit `uvrn-home`, migrate stored
records, or alter a package hash/sign surface (D2, D4, ADR-006, ADR-010).
