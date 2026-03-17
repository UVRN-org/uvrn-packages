# Build discipline for adapter ethers → noble refactor

Per [.cursor/rules/build-discipline.mdc](../../.cursor/rules/build-discipline.mdc), when executing the **Replace ethers with @noble in @uvrn/adapter** plan, include the following.

## Package CHANGELOG and README

- **README:** Update [uvrn-adapter/README.md](../../uvrn-adapter/README.md) as in the plan (usage with private key hex instead of Wallet). Already in scope.
- **Package CHANGELOG:** Create or update the adapter package changelog:
  - If it does not exist, create **uvrn-adapter/CHANGELOG.md** (format: Keep a Changelog; link from root CHANGELOG if desired).
  - Add an entry for this change, e.g.:
    - **Changed:** Replaced `ethers` with `@noble/hashes` and `@noble/secp256k1` for EIP-191 signing; reduced dependency footprint.
    - **Breaking:** `wrapInDRVC3(deltaReceipt, signer, options)` now accepts `signerPrivateKeyHex: string` instead of `signer: Wallet | HDNodeWallet`. `signHash(hash, privateKeyHex)` replaces `signHash(hash, wallet)`.
- **Root CHANGELOG:** Add a line under `[Unreleased]` (or next version) in [CHANGELOG.md](../../CHANGELOG.md) referencing the adapter refactor and breaking API change.

## Reports and build log (on completion)

When the phase is complete:

1. **Short report**  
   Add **docs/reports/2026-03-17-adapter-ethers-to-noble.md** (or current date) summarizing:
   - What was implemented (ethers removed, noble stack in place, signer API change, tests/docs updated).
   - What remains (e.g. none, or follow-ups like publishing a new adapter version).

2. **Build log**  
   Add **docs/reports/2026-03-17-adapter-ethers-to-noble-build-log.md** with:
   - **(1)** Summary of what was done, with references to relevant files (e.g. `uvrn-adapter/src/signer.ts`, `uvrn-adapter/package.json`, test files, README).
   - **(2)** Good next steps and where to look (e.g. run tests, bump version for release, update consumers that pass a Wallet to pass private key instead).

No ADR is required unless you introduce a formal architecture decision worth recording in `docs/decisions/`.
