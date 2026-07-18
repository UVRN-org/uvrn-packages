# Changelog

## [4.1.0] - 2026-07-18 (unreleased)

### Changed
- Removed the live hand-copied canonicalizer. Identity evidence payloads now import the
  environment-pure `@uvrn/core/canonical-serialize-2` implementation directly.
- True sparse array holes serialize as JSON `null`; non-finite / non-JSON values reject.
- Existing valid-JSON `uvrn-sig-1` payload bytes remain unchanged.

## [4.0.0] - 2026-06-10 (unreleased, v4 / fable-refactor-1)

### Added
- `IdentityRegistry.recordEvent(args)`: evidence-based reputation recording. Events may carry `AttestedEvidence` (Ed25519 signature over the JCS-canonical `{ publicKeyRef, receiptHash, schemaVersion, sigVersion: 'uvrn-sig-1', signedAt? }` payload); verified events count fully and are keyed by the public key, unverified/evidence-free events are still accepted but flagged `attested: false` and weighted at `unattestedWeight` (default `0.25`).
- `AttestedEvidence` and `RecordEventArgs` types; `ReputationScore.attestedReceipts` (additive).
- `IdentityRegistryOptions.unattestedWeight` (default `0.25`) and `IdentityRegistryOptions.accuracyHalfLifeMs` (optional time decay on event weight, default off).
- Exported `buildEvidencePayload()`, `verifyAttestedEvidence()`, and `SIG_VERSION` so hosts sign and verify the exact canonical payload (local RFC 8785 JCS copy — the package stays zero-dep).
- README "Sybil note": UVRN claims sybil awareness, not sybil resistance.

### Unchanged
- Legacy `record()` keeps its v3 whole-receipt semantics for compatibility.

## [3.0.0] - 2026-06-09

### Changed
- **UVRN Packages v3 — canonical 23-package protocol generation.** All packages aligned to `3.0.0`; internal `@uvrn/*` peer ranges moved to `^3.0.0` so v3 packages resolve only against v3 peers. This release is the canonical source of truth and supersedes prior npm/official versions.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

Initial release. Signer reputation registry and storage contract for UVRN.

### Added
- `IdentityRegistry` for reputation lookup, activity recording, and leaderboards
- `IdentityStore` interface for custom backend implementations
- `MockIdentityStore` in-memory implementation for zero-external usage
- v1 additive reputation scoring with accuracy, canon rate, and volume inputs
