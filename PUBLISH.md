# Publishing UVRN packages (public @uvrn/*)

**pnpm only.** Admin GO is required before any registry write.

## Scope

| Set | Scope | Count | Access | Version |
|-----|-------|-------|--------|---------|
| Public spine + advancements | `@uvrn/*` | 33 | `public` | `5.0.0`–`5.0.2` |

**Recent advancements (MIT):** `@uvrn/visual`, `@uvrn/chart-memory`, `@uvrn/track-record` @ `5.0.1`.

Maintainer ops packages (archive, checker, case-bank, D1 client) are **not in this repo** — they publish separately under restricted scope when needed.

**Canon/identity checker seam:** `@suttlemedia/checker` is an optional npm peer for `@uvrn/canon` and `@uvrn/identity` — install separately if your host needs the org-restricted checker.

## Publish posture

- All packages in this repo: `@uvrn/*` + `publishConfig.access: "public"`.
- Gate: `pnpm run check:phase1-gates` must pass before publish.

## Commands (never publish from this doc alone)

```bash
pnpm install
pnpm -r run build
pnpm -r --if-present run test
pnpm run check:phase1-gates
```

## Publish order (typical)

1. Core spine packages as needed (dependency order).
2. **`@uvrn/visual`**, **`@uvrn/chart-memory`**, **`@uvrn/track-record`** @ `5.0.1` when patching.
3. **`@uvrn/store-sqlite@5.0.2`** (peer → `@uvrn/track-record`).
4. **`@uvrn/mcp`** when manifest or optional-peer docs need a patch.

Example (Admin GO only):

```bash
# pnpm -r publish --filter "@uvrn/visual" --filter "@uvrn/chart-memory" --filter "@uvrn/track-record" --access public --no-git-checks
```

## Public irreversibility

Once `@uvrn@5.0.0` is public on the registry for **72 hours**, npm's unpublish rules make rollback of that public line effectively irreversible for most packages. Treat branch **`legacy/v4-main`** as the rollback path if 5.0.0 must be abandoned after the window.

## `store-sqlite` note

Anonymous public consumers install `@uvrn/store-sqlite` main entry only. Track-record SQLite APIs are on `@uvrn/store-sqlite/track-record` and need optional peer `@uvrn/track-record`.
