# Build Report — @uvrn/consensus
**Date**: 2026-04-01
**Wave**: 3
**Build agent**: Codex
**Audit + remediation**: Claude (protocol/integration lead)

---

## Build Status

- **TypeScript**: ✅ 0 errors
- **Tests**: 6/6 pass
- **dist/ in .gitignore**: ✅
- **No composite: true**: ✅
- **peerDependencies**: `@uvrn/core >=1.0.0`, `@uvrn/agent >=1.0.0` (CONS-01 remediation applied)
- **Optional peer**: `@uvrn/farm`
- **README**: ✅ Complete with minimal install, ranking model, parsing docs, output contract
- **CHANGELOG**: ✅ v1.0.0 entry
- **LICENSE**: ✅ MIT

## Test Summary

| Test | Result |
|------|--------|
| buildBundle() returns core-valid DeltaBundle | ✅ |
| Weights not summing to 1.0 throws | ✅ |
| Sources sorted by weighted score descending | ✅ |
| Deduplication removes near-identical sources | ✅ |
| stats() returns deterministic scores + summary | ✅ |
| buildBundle() throws ConsensusError < 2 sources | ✅ |

## Deviations from Build Prompt

- `buildBundle()` with empty sources throws `ConsensusError` instead of returning an empty bundle. This was the approved plan deviation (fail explicitly with fewer than 2 usable numeric sources).

## Observations for Future

- Numeric extraction is regex-based; fragile on diverse source text (noted in audit residual risks)
- `#rankedSources()` not cached — minor optimization opportunity

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
