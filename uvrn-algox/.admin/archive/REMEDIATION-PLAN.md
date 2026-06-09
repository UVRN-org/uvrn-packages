# Remediation Notes — `@uvrn/algox` v2.0.0

> Status: **EXECUTED** for the LIVE workspace integration pass.

## Summary

The audit findings from `1.0.0-draft.1` were addressed as part of the v2
promotion into the UVRN package workspace. The package is now treated as a
first-class workspace package and is validated through pnpm filter gates.

## Implemented

- Guard invalid `config.now`; fall back to current time and emit `invalid_now`.
- Coerce non-finite/non-numeric signal reads to `0` through `readNumericField()`.
- Merge partial `weights` over default prominence scoring.
- Add strongest-wins duplicate handling through `dedupByKey(..., { prefer })`.
- Normalize `www.`, `m.`, and `amp.` host prefixes and expose `hostOf()`.
- Use `source ?? hostOf(url) ?? label` for preset source caps.
- Clamp `topK` and `capPerSource` to at least `1` and emit warnings for invalid knobs.
- Warn on negative weights.
- Treat whitespace-only required fields as missing.
- Keep `ctx.candidates` consistent with `ctx.selected` after `topK`.
- Warn when selected count is below resolved `topK`.
- Update README examples, changelog, package metadata, and focused tests.

## Deferred

- Class facade parity (`AlgoxEngine`) remains deferred until there is a concrete
  package-level need.
- Prototype-pollution hardening remains low priority because current inputs are
  candidate objects from agent JSON rather than untrusted object literals.

## Verification

- `pnpm --filter @uvrn/algox run test`
- `pnpm --filter @uvrn/algox run build`
