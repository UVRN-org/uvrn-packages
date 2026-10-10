# UVRN Packages — Changelog

Earlier generations (v1–v4, 5.0) are legacy and no longer maintained.

## [5.1 alignment] — 2026-10-10 — every public package on the 5.1 line

- **Versions:** the 27 packages at `5.0.1` and `@uvrn/visual`, `@uvrn/chart-memory` (`5.0.2`) → `5.1.0`; `@uvrn/cli`, `@uvrn/mcp`, `@uvrn/track-record`, `@uvrn/store-sqlite` `5.1.0 → 5.1.1`; `@uvrn/probability` `0.3.0 → 0.3.1`. Order in [`PUBLISH.md`](PUBLISH.md).
- **Ranges:** `@uvrn/*` peer ranges raised from `^5.0.0` to `^5.1.0`; in-repo dependencies stay `workspace:^`. The `@uvrn/probability` optional peer range is unchanged.
- `@uvrn/mcp` handshake `serverInfo.version` and `plugin-manifest.json` report `5.1.1`.
- No API or behaviour changes; no changes to SPECs, schemas, hashed field lists or golden vectors.

## [5.1.0 round — release-test fixes] — 2026-10-06

- **Versions:** 27 packages `5.0.0 → 5.0.1`; `@uvrn/visual`, `@uvrn/chart-memory` `5.0.1 → 5.0.2`; `@uvrn/probability` 0.3.0 and the four 5.1.0 packages unchanged (not yet published). Order in [`PUBLISH.md`](PUBLISH.md).
- **Install:** `better-sqlite3` moves to 12.x for workspace dev installs (Node 26 support); `@uvrn/store-sqlite` optional peer accepts `^11 || ^12`. `visual`/`chart-memory` declare `engines.node`.
- **Packaging:** `@uvrn/api` bin runs (shebang, no dev-only logger); `@uvrn/embed` `require()` works, UMD at `./umd`; `@uvrn/sdk` ESM import works and `VERSION` follows package.json; `@uvrn/test`, `@uvrn/store-sqlite`, `@uvrn/mcp` types resolve on a solo install.
- **Behaviour:** `uvrn verify-receipt --key` exits 2 when the signature does not verify; `@uvrn/mcp` loads `@uvrn/probability` from the host (true optional peer) and bundles the rest.
- **Honesty / hygiene:** sdk and canon docs no longer call hash-only checks "verified"; a private package name removed from canon types; `scripts/check-published-purity.mjs` scans all 34 packed packages; `prepublishOnly` guard refuses `npm publish`.
- **License: Apache-2.0** for all 34 packages and the repo, with a NOTICE file in every package ("Built on UVRN" attribution, required on redistribution under §4(d); §6 reserves the UVRN name).
- No changes to SPECs, schemas, hashed field lists or golden vectors.

## [5.1.0] — 2026-10-02 — `@uvrn/cli`, `@uvrn/mcp`, `@uvrn/track-record`, `@uvrn/store-sqlite` 5.1.0 + `@uvrn/probability` 0.3.0

- **`@uvrn/cli@5.1.0`:** `uvrn prob run` — receipted probability via the optional peer `@uvrn/probability` (legacy `runProbability`, SPEC `uvrn-probability-v1`).
- **`@uvrn/mcp@5.1.0`:** tool 14, `delta_prob_run` (additive; 13 → 14). Handshake `serverInfo.version` and `plugin-manifest.json` report `5.1.0`; test fixtures no longer ship in the tarball.
- **`@uvrn/track-record@5.1.0`:** forecast log (every output, refusals included), multi-class Brier (`brierMultiScore`), `reliabilityBins` — additive.
- **`@uvrn/store-sqlite@5.1.0`:** `SqliteTrackRecordStore` forecast-log methods on two new additive tables; optional peer `@uvrn/track-record` → `^5.1.0`.
- **`@uvrn/probability@0.3.0`:** first registry release (entries below). Order: probability → track-record → store-sqlite → cli → mcp (see [`PUBLISH.md`](PUBLISH.md)).
- No changes to existing SPECs, schemas, or golden vectors. This public release adds the probability SPECs (v1–v3), schemas, and vectors; the v1/v2/v3 vectors are byte-identical to the private source.

## [probability 0.3.0] — fixed-offset local deadlines (released in the 5.1.0 round)

- **`SPEC/uvrn-probability-v3.md`** + `uvrn-probability-input-3` / `-result-3` schemas + `SPEC/vectors/probability-v3.json` (17 cases, 11 validation errors). New contract `uvrn-probability-3` with a required `question.resolveByOffset` (fixed UTC offset; no time zones) and question identity `uvrn-probability-question-2`. Additive: v1 and v2 schemas and vectors are unchanged; the v1 spec is untouched; the v2 spec's §4.1 origin row now names the pinned `0.2.0` origin and its header gains a successor note. `verifyForecastReceipt` recomputes the v3 deadline record from the question (`deadlineOk`).
- **`@uvrn/probability@0.3.0`:** `runForecast` dispatches on `input-2` / `input-3`; the v2 origin is pinned at `0.2.0` (`FORECAST_V2_ORIGIN`) and v3 at `0.3.0`, so releases no longer move golden vectors.
- `@uvrn/cli` / `@uvrn/mcp`: optional peer range widened to `^0.1.0 || ^0.2.0 || ^0.3.0`; adapters unchanged (still call `runProbability`).

## [probability 0.2.0] — forecast contract (never published separately; included in 0.3.0)

- **`SPEC/uvrn-probability-v2.md`** + `uvrn-probability-input-2` / `-result-2` schemas + `SPEC/vectors/probability-v2.json` (13 cases). Additive: `uvrn-probability-1`, its schemas, and its 16 vectors are unchanged; the v1 spec gets a header note only.
- **`@uvrn/probability@0.2.0`:** `runForecast` with caller-selected `market | baserate | judgment`, `questionHash` / `forecastId` / `probabilityHash` identities, optional validated `uvrn-outcome-1` bindings, internal judgment module (`/judgment` subpath), conservative v2 base-rate refusals, event-cutoff deadline matching, `verifyForecastReceipt`. Legacy `runProbability` keeps the 0.1.0 origin. `AGENT-GUIDE.md` ships in the package.
- `@uvrn/cli` / `@uvrn/mcp`: optional peer range widened to `^0.1.0 || ^0.2.0`; adapters unchanged (still call `runProbability`).

