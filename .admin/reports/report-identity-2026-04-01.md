# Build Report — @uvrn/identity
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
- **peerDependencies**: `@uvrn/core >=1.0.0` (IDN-01 remediation: `@uvrn/adapter` removed)
- **README**: ✅ Complete with IdentityStore contract, MockIdentityStore, formula, levels, custom store examples
- **CHANGELOG**: ✅ v1.0.0 entry
- **LICENSE**: ✅ MIT

## Test Summary

| Test | Result |
|------|--------|
| reputation() returns stored score | ✅ |
| reputation() returns null for unknown | ✅ |
| record() updates score/accuracy/canonRate | ✅ |
| Formula calculates correctly | ✅ |
| Level thresholds applied correctly | ✅ |
| MockIdentityStore save/get/record/leaderboard | ✅ |

## Deviations from Build Prompt

- `ReputationActivity.consensusVScore` is required (not optional) per approved plan decision.
- `@uvrn/adapter` peer dep removed post-audit — phantom re-export of `DRVC3Receipt` had no consumers (IDN-01).

## Observations for Future

- Level gap: signers with `receipts >= 10` and `score < 60` get level `'new'` — spec ambiguity, not a defect (IDN-02)
- Float accumulation in accuracy/canonRate tracking over many records (IDN-03) — low impact for v1 additive model

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
