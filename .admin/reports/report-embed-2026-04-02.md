# Build Report — @uvrn/embed
**Date**: 2026-04-02
**Wave**: 4
**Build agent**: Codex
**Audit + remediation**: Audit complete; `EMB-01` remediated 2026-04-02

---

## Build Status

- **TypeScript**: ✅ 0 errors
- **Tests**: 8/8 pass
- **UMD build**: ✅ `dist/embed.umd.js` generated via `esbuild`
- **dist/ in .gitignore**: ✅
- **No composite: true**: ✅
- **peerDependencies**: `react >=17.0.0`, `react-dom >=17.0.0`
- **README**: ✅ Complete with React usage, UMD usage, self-hosting, cache docs
- **CHANGELOG**: ✅ v1.0.0 entry + remediation note
- **LICENSE**: ✅ MIT

## Test Summary

| Test | Result |
|------|--------|
| renders STABLE status and score | ✅ |
| renders DRIFTING and CRITICAL status states | ✅ |
| loading state renders during in-flight fetch | ✅ |
| unavailable state renders when fetch throws | ✅ |
| unavailable state renders on non-OK response | ✅ |
| in-memory cache serves within TTL | ✅ |
| cache refreshes after TTL expiry | ✅ |
| `UVRN.init()` renders `[data-uvrn-claim]` elements | ✅ |

## Deviations from Build Prompt

- Added internal shared runtime helpers in `src/runtime/badge.ts` so React and UMD paths share the exact same cache, fetch, theme, and presentation logic. This is an internal implementation detail only; the public API remains prompt-aligned.
- Audit remediation removed the phantom `@uvrn/core` dependency entries from `package.json` and aligned README/CHANGELOG with the actual package contract. No runtime changes were required.

## Observations for Audit

- Cache is keyed only by `claimId`, matching the prompt exactly. Audit should confirm this is acceptable when the same claim id is rendered against different `apiUrl` values.
- The UMD build uses inline styles and zero runtime dependencies. There is no CSS asset to ship separately.

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
