# UVRN Package Couplings

Explicit sibling dependencies in this protocol are intentional and documented
here. The design principle: **explicit couplings are acceptable; silent
duplication is not.**

## @uvrn/drift → @uvrn/score

`@uvrn/drift` imports `WEIGHTS` from `@uvrn/score` in both `src/index.ts` and
`src/agent-api.ts` to recompute V-Score with decayed freshness. This is a peer
dependency. `@uvrn/core` is the single source of truth for V-Score weights
(`VSCORE_WEIGHTS`); `@uvrn/score` re-exports them as `WEIGHTS` (passthrough, not
duplication). `@uvrn/drift` imports `WEIGHTS` from `@uvrn/score` and must not
redefine them.

This is an intentional upward coupling from Layer 3 to Layer 2. Drift needs
the canonical weights to recompute composite scores after freshness decay;
importing them is preferred over silent local duplication.

## @uvrn/consensus → @uvrn/score (via ConsensusResult)

`ConsensusResult.components` (output of `buildConsensusResult()`) maps directly
to `ScoreInputComponents` (input to `@uvrn/score` `ScoreBreakdown`). Pass
`result.components` directly:

```ts
const result = engine.buildConsensusResult();
const breakdown = new ScoreBreakdown(result.components, profile);
```

This is not a package-level import — it is a data contract. No peer dep required.

Component mapping:

| ConsensusResult field | Source stat | Meaning |
|----------------------|-------------|---------|
| `completeness` | `coverageScore` | % of input sources that yielded usable numeric evidence |
| `parity` | `agreementScore` | Near-identical sources are deduped first, then parity = the largest retained numeric-value cluster after two-decimal normalization |
| `freshness` | `recencyScore` | Average recency score across ranked sources |

Note: `ConsensusResult` maps consensus source stats into V-Score input
components. It does **not** convert a `DeltaReceipt` from `@uvrn/core` into
V-Score components. Delta and V-Score remain separate protocol layers.

## @uvrn/drift → @uvrn/core (existing)

`@uvrn/drift` already peers on `@uvrn/core` for receipt types. This
is pre-existing and intentional.

## Adding new couplings

If a new package needs to import constants, types, or functions from a sibling:

1. Add it as a peer dependency in `package.json`
2. Document it here with the reason and usage pattern
3. Never duplicate the constant — import it

## @uvrn/receipt → @uvrn/core (since v4)

`@uvrn/receipt` peer-depends on `@uvrn/core` for the protocol types
(`DeltaReceipt`, `MasterReceipt`) and, in tests, the frozen v3 hash path
(`hashReceipt`, `verifyReceipt`, `verifyMasterReceipt`) to prove that wrapping
never disturbs base-receipt verifiability. It has **no other dependencies** and
zero UI dependencies.

Reverse rule: every other surface (packages, MCP, worker, site, dashboard)
consumes `@uvrn/receipt` for envelope shape, canonicalization
(`@uvrn/receipt/canonical`), signing, and human vocabulary
(`@uvrn/receipt/vocabulary`). No surface defines its own receipt shape or
duplicates JCS/hash logic — that duplication (worker `src/index.ts`, site
`src/api/uvrn.js`) is retired in Phases 5–6.

## @uvrn/store-sqlite → canon / identity / timeline / watch / agent / receipt (since v4)

`@uvrn/store-sqlite` implements the store interfaces those packages define
(`CanonStore`, `IdentityStore`, `TimelineStore`, `WatchStore`, `AgentStateStore`)
against one local SQLite file, plus the `SqliteReceiptStore` outbox with
`pushToNetwork()`. All optional peer deps; `better-sqlite3` is a lazily-required
optional peer. Direction is one-way (store-sqlite → protocol packages); no
protocol package gains storage — the interfaces stay the seam.

`SqliteTrackRecordStore` (subpath `@uvrn/store-sqlite/track-record`, never the
main entry) implements `TrackRecordStore` from `@uvrn/track-record`, an optional
peer at `^5.1.0` since store-sqlite 5.1.0 (it imports the forecast-log types).

## @uvrn/protocol → core / receipt / measure / consensus / score / signal (since v4)

The umbrella package (decision D-3) re-exports the common path as real
`workspace:^` dependencies (rewritten to `^5.1.0` on publish). It adds no logic;
the coupling is the package's entire purpose.

## @uvrn/mcp → @uvrn/receipt and @uvrn/cli → @uvrn/receipt (since v4)

Both consume the canonical receipt object model: mcp's `delta_score_claim`
returns a signed NetworkReceipt + HumanView (enriched before hashing); cli's
`verify-receipt` command runs `verifyReceiptFull`. Peer deps, no cycles
(receipt depends only on core).

## @uvrn/probability → @uvrn/receipt (probability layer)

`@uvrn/probability` peer-depends on `@uvrn/receipt` only: JCS canonicalization
(`@uvrn/receipt/canonical`), `sha256Hex`, `computeNetworkReceiptHash`,
`claimIdFromText`, `signReceipt`, and `verifyReceiptFull`. It never re-implements
JCS, hashing, or Ed25519. Its `uvrn-probability-1`, `uvrn-probability-2`, and
`uvrn-probability-3` hashes (and the `uvrn-probability-question-1` / `-question-2`
question identities) are new closed field lists (SPEC `uvrn-probability-v1.md`,
`uvrn-probability-v2.md`, `uvrn-probability-v3.md`); no frozen
hash list is touched. Version 1 binds to `uvrn-outcome-1` by the `outcomeHash`
string only; version 2 optionally recomputes a supplied `uvrn-outcome-1`
declaration from its six declared fields through the same receipt primitives —
still no import of an outcome package. The judgment module is internal to the
package. UVRN readings (V-Score, agreement, drift, stance, signal) are never
imported: hosts supply and store them. Probability shares no field or type with
V-Score (`@uvrn/score`). `oddsmith` is a dev-only cross-check, never a runtime
dependency.

## @uvrn/cli → @uvrn/probability and @uvrn/mcp → @uvrn/probability

`uvrn prob run` (`@uvrn/cli` 5.1.0) and `delta_prob_run` (`@uvrn/mcp` 5.1.0) are
thin adapters over `runProbability` (the legacy version-1 interface; version-2/3
`runForecast` dispatch is optional follow-on work). Both take `@uvrn/probability` as an **optional** peer
(`^0.1.0 || ^0.2.0 || ^0.3.0`) and load it lazily, so installs without it are unaffected. The CLI reads the signing seed
from an environment variable, never argv; MCP signs with its resolved signer.

## @uvrn/probability ↔ @uvrn/track-record (data contract only)

No import in either direction. Hosts log each probability output (refusals
included) with `TrackRecordStore.logForecast` as a `ForecastLogEntry`
(`originId` = the result `origin`, `method`, `refused`, `forecastP`,
`outcomeHash`, `receiptHash`) and later resolve it with `buildForecastResolution`
or `buildMultiForecastResolution`. Version-2 hosts may map binary YES `p` or a
complete categorical distribution the same way; consuming `questionHash`,
`forecastId`, or `probabilityHash` in track-record is optional future work.
