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

## @uvrn/receipt → @uvrn/core (v4)

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

## @uvrn/store-sqlite → canon / identity / timeline / watch / agent / receipt (v4)

`@uvrn/store-sqlite` implements the store interfaces those packages define
(`CanonStore`, `IdentityStore`, `TimelineStore`, `WatchStore`, `AgentStateStore`)
against one local SQLite file, plus the `SqliteReceiptStore` outbox with
`pushToNetwork()`. All optional peer deps; `better-sqlite3` is a lazily-required
optional peer. Direction is one-way (store-sqlite → protocol packages); no
protocol package gains storage — the interfaces stay the seam.

## @uvrn/protocol → core / receipt / measure / consensus / score / signal (v4)

The umbrella package (decision D-3) re-exports the common path as real
`workspace:^` dependencies (rewritten to `^4.0.0` on publish). It adds no logic;
the coupling is the package's entire purpose.

## @uvrn/mcp → @uvrn/receipt and @uvrn/cli → @uvrn/receipt (v4)

Both consume the canonical receipt object model: mcp's `delta_score_claim`
returns a signed NetworkReceipt + HumanView (enriched before hashing); cli's
`verify-receipt` command runs `verifyReceiptFull`. Peer deps, no cycles
(receipt depends only on core).
