# UVRN Packages — Agent Context (public repo)

This is the UVRN protocol monorepo: 26 `@uvrn/*` packages (v4 generation) plus the
protocol specifications in `SPEC/`. It is a public, MIT-licensed open-source project.

## Build & test

```bash
pnpm install
pnpm -r build
pnpm -r test
```

pnpm ≥ 11.5 note: packages with build scripts must be approved via `allowBuilds` in the
workspace config (already set — `onlyBuiltDependencies` alone is not sufficient).

## Binding laws (do not violate)

1. **Additive-only against live receipts.** The legacy `drvc3-receipt-1` hash contract and
   the `uvrn-receipt-4` hash field list are FROZEN (`SPEC/uvrn-receipt-v1.md`). New fields
   may be added; existing hashed fields may never change meaning, order, or encoding.
   Golden vectors in `SPEC/` must keep passing byte-identically.
2. **Honest vocabulary.** A hash recompute alone is "integrity-checked". "Verified" requires
   integrity AND a producer signature that checks out (`SPEC/uvrn-signing-v1.md`). Never
   claim more than the math proves — in code, docs, or UI strings.
3. **In-repo dependencies use `workspace:^`** so publishing rewrites them to the released
   version range.

## Layout

- `uvrn-*/` — one package each; `src/` TypeScript, `dist/` build output (gitignored),
  per-package README + CHANGELOG + tests.
- `SPEC/` — implementation-independent protocol specs + golden test vectors. Spec changes
  are protocol changes: they need their own PR and review.
- `uvrn-protocol` is the umbrella package; `uvrn-core`, `uvrn-receipt`, `uvrn-measure`,
  `uvrn-consensus`, `uvrn-score`, `uvrn-signal` are its direct deps.

See `CONTRIBUTING.md` for the PR workflow. Historical references to `admin/` in the
CHANGELOG point to the maintainers' internal ops archive, which is not part of this repo.
