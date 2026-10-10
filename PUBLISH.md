# Publishing UVRN packages (public @uvrn/*)

**pnpm only.** Do not use `npm publish` in this repo. Owner GO is required before any registry write.

## Scopes

| Set | Scope | Count | Access | Version |
|-----|-------|-------|--------|---------|
| Public spine + advancements | `@uvrn/*` | 33 | `public` | `5.1.0`; `cli`, `mcp`, `track-record`, `store-sqlite` → `5.1.1` |
| Probability layer | `@uvrn/probability` | 1 | `public` | `0.3.1` |


**Public advancements (Apache-2.0):** `@uvrn/visual`, `@uvrn/chart-memory` @ `5.1.0`; `@uvrn/track-record` @ `5.1.1`.


**`@uvrn/probability`** (Apache-2.0, `access: public`; counted in the public gates, which expect 34) is
first published at `0.3.0` in the 5.1.0 round and ships `0.3.1` in the 5.1 alignment release. Owner decision 2026-10-02: probability 0.3.0 and the four 5.1.0 packages publish
publicly from the public repo (`UVRN-org/uvrn-packages`); publishing still requires owner GO and a 2FA
code at publish time. `@uvrn/cli` and `@uvrn/mcp` take it as an optional peer
`^0.1.0 || ^0.2.0 || ^0.3.0` (their adapters call the legacy `runProbability` only), so
`@uvrn/probability` publishes before them. `@uvrn/mcp` bundles every other `@uvrn/*` package
and loads only `@uvrn/probability` from the host.


## Publish posture (current)

- Promoted packages (`visual`, `chart-memory`, `track-record`) must be `@uvrn/*` + `access: public`.
- Gate: `pnpm run check:phase1-gates` must pass before publish.

## Commands (never publish from this doc alone)

```bash
pnpm install
pnpm -r run build
pnpm -r --if-present run test
pnpm run check:phase1-gates
```

## Publish order — 5.1 alignment release (current; all 34 packages)

Owner decision 2026-10-10: every public package publishes on the 5.1 line (33 at `5.1.x`,
`@uvrn/probability` at `0.3.x`) so the registry carries the public repository URL and the release-test fixes. Published from the **public repo**
(`UVRN-org/uvrn-packages`) `main`, in this dependency order (each from its package folder with
`pnpm publish --access public`; owner GO + 2FA required). A `prepublishOnly` guard
(`scripts/guard-pnpm-publish.mjs`) refuses `npm publish`.

1. `@uvrn/core@5.1.0`
2. `@uvrn/adapter@5.1.0`
3. `@uvrn/score@5.1.0`
4. `@uvrn/drift@5.1.0`
5. `@uvrn/agent@5.1.0`
6. `@uvrn/algox@5.1.0`
7. `@uvrn/api@5.1.0`
8. `@uvrn/canon@5.1.0`
9. `@uvrn/timeline@5.1.0`
10. `@uvrn/chart-memory@5.1.0`
11. `@uvrn/receipt@5.1.0`
12. `@uvrn/probability@0.3.1`
13. `@uvrn/cli@5.1.1`
14. `@uvrn/compare@5.1.0`
15. `@uvrn/consensus@5.1.0`
16. `@uvrn/embed@5.1.0`
17. `@uvrn/farm@5.1.0`
18. `@uvrn/identity@5.1.0`
19. `@uvrn/jsonld@5.1.0`
20. `@uvrn/normalize@5.1.0`
21. `@uvrn/lattice@5.1.0`
22. `@uvrn/mcp@5.1.1`
23. `@uvrn/measure@5.1.0`
24. `@uvrn/meta-readout@5.1.0`
25. `@uvrn/pattern@5.1.0`
26. `@uvrn/signal@5.1.0`
27. `@uvrn/protocol@5.1.0`
28. `@uvrn/sdk@5.1.0`
29. `@uvrn/track-record@5.1.1`
30. `@uvrn/watch@5.1.0`
31. `@uvrn/store-sqlite@5.1.1`
32. `@uvrn/test@5.1.0`
33. `@uvrn/validate@5.1.0`
34. `@uvrn/visual@5.1.0`

Every package comes after the `@uvrn/*` packages it depends on or peers with.


## Public irreversibility

Once a version has been public on the registry for **72 hours**, npm's unpublish rules make rollback effectively irreversible for most packages. Fix forward with a new patch version; a published version number can never be reused.


## `store-sqlite` note

Anonymous public consumers install `@uvrn/store-sqlite` main entry only — no private-scope token required. Track-record SQLite APIs are on `@uvrn/store-sqlite/track-record` and need optional peer `@uvrn/track-record` (`^5.1.0`).
