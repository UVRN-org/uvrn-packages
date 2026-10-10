# Contributing to UVRN Packages

Thanks for your interest in the UVRN protocol. This monorepo holds the 26 `@uvrn/*`
packages and the protocol specifications in `SPEC/`.

## Getting started

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Requirements: Node ≥ 20, pnpm ≥ 9. Note for pnpm ≥ 11.5: packages with build scripts are
approved via `allowBuilds` in the workspace config (already set — if builds are silently
skipped, check this before anything else).

## Project shape

- One directory per package (`uvrn-*/`): `src/` TypeScript, tests alongside, per-package
  README and CHANGELOG. `dist/` is build output and is never committed.
- `SPEC/` contains the protocol specifications (receipt envelope & hashing, measurement,
  signing, network API) plus golden test vectors. **A spec change is a protocol change** —
  open an issue first, and expect a higher review bar.
- In-repo dependencies use `workspace:^` so releases rewrite them to the published range.

## The two binding laws

Every contribution must respect these; PRs that break them will not merge:

1. **Additive-only against live receipts.** The `drvc3-receipt-1` legacy contract and the
   `uvrn-receipt-4` hashed field list are frozen. You may add fields; you may never change
   the meaning, order, or encoding of an existing hashed field. The golden vectors in
   `SPEC/` must keep passing byte-identically — they are the law in executable form.
2. **Honest vocabulary.** A hash recompute alone is *integrity-checked*. *Verified* means
   integrity AND a producer signature that checks out. Code, docs, and UI strings must
   never claim more than the math proves.

## Pull requests

1. Fork, branch from `main`, keep PRs focused (one package or one concern).
2. `pnpm -r build && pnpm -r test` must pass locally; CI runs the same.
3. Add or update tests for any behavior change; update the package's CHANGELOG.
4. New packages, spec changes, and anything touching hashing/signing get extra scrutiny —
   describe the receipt-compatibility impact in the PR body.

## Reporting issues

Use GitHub issues for bugs and proposals. For security vulnerabilities, see
[SECURITY.md](SECURITY.md) — please do not open public issues for those.
