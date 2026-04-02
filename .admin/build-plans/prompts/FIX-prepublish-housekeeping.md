# Fix Prompt: Pre-Publish Housekeeping — COMPLETED
# Target: Cursor / Claude Code
# Context: uvrn-packages-next — v2.0.0-next gate blockers

**Date**: 2026-04-02
**Status**: ✅ ALL FIXES APPLIED by Claude Cowork session 2026-04-02
**Protocol**: Bloom Protocol v1.7

---

## Summary of Changes Applied

All three blockers resolved, plus version upgrade and workspace cleanup:

1. **`.gitignore` added** to `uvrn-farm`, `uvrn-normalize`, `uvrn-watch`, `uvrn-embed` (standardized template matching wave 1 packages)
2. **`.gitignore` normalized** for `uvrn-consensus`, `uvrn-compare`, `uvrn-identity`, `uvrn-timeline` (from minimal `dist/`-only to full standard)
3. **`uvrn-embed/CHANGELOG.md`** — `[Unreleased]` section folded into release entry
4. **Root `README.md`** — package status table updated, "Build Waves" → "Release Status"
5. **All 11 `package.json`** — version bumped from `1.0.0` → `2.0.0`
6. **All 11 `CHANGELOG.md`** — entry headers updated from `[1.0.0]` → `[2.0.0]`
7. **`pnpm-workspace.yaml`** — comments updated to reflect completed wave status

---

## Remaining Steps (for Shawn / Claude Code)

```bash
# 1. Remove stale lock file (if still present)
rm -f .git/index.lock

# 2. Stage and commit wave 3 packages + all housekeeping changes
git add uvrn-compare uvrn-consensus uvrn-identity uvrn-timeline
git add uvrn-farm/CHANGELOG.md uvrn-farm/.gitignore
git add uvrn-normalize/.gitignore
git add uvrn-watch/.gitignore
git add uvrn-embed/.gitignore uvrn-embed/CHANGELOG.md
git add uvrn-signal/CHANGELOG.md uvrn-signal/package.json
git add uvrn-score/CHANGELOG.md uvrn-score/package.json
git add uvrn-test/CHANGELOG.md uvrn-test/package.json
git add uvrn-farm/package.json
git add uvrn-normalize/CHANGELOG.md uvrn-normalize/package.json
git add uvrn-consensus/CHANGELOG.md uvrn-consensus/package.json
git add uvrn-compare/CHANGELOG.md uvrn-compare/package.json
git add uvrn-identity/CHANGELOG.md uvrn-identity/package.json
git add uvrn-timeline/CHANGELOG.md uvrn-timeline/package.json
git add uvrn-watch/CHANGELOG.md uvrn-watch/package.json
git add uvrn-embed/package.json
git add README.md pnpm-workspace.yaml

# Force-add admin artifacts (ignored by root .gitignore)
git add -f .admin/audits/audit-wave3-2026-04-01.md
git add -f .admin/reports/report-compare-2026-04-01.md
git add -f .admin/reports/report-consensus-2026-04-01.md
git add -f .admin/reports/report-identity-2026-04-01.md
git add -f .admin/reports/report-timeline-2026-04-01.md
git add -f .admin/reports/report-wave3-2026-04-01.md
git add -f .admin/reports/report-wave2-farm-05-remediation-2026-04-01.md
git add -f .admin/reports/report-publish-readiness-2026-04-02.md
git add -f .admin/build-plans/MASTER-BUILD-PLAN.md
git add -f .admin/build-plans/prompts/FIX-prepublish-housekeeping.md

# 3. Commit
git commit -m "chore: wave 3 packages, v2.0.0 version bump, pre-publish housekeeping

- Add wave 3 packages: consensus, compare, identity, timeline
- Bump all 11 new packages from v1.0.0 to v2.0.0
- Add/normalize .gitignore for all 11 packages
- Resolve embed CHANGELOG [Unreleased] section (EMB-01)
- Update root README status table (all packages → Built + audited)
- Update pnpm-workspace.yaml comments
- Add wave 3 audit report and admin artifacts"

# 4. Run full build + test
pnpm run build
pnpm run test

# 5. If clean, tag
git tag v2.0.0-next
git push && git push --tags
```

---

*Bloom Protocol — Fix prompt (completed) | Claude Cowork 2026-04-02*
