# UVRN Package Couplings

Explicit sibling dependencies in this protocol are intentional and documented
here. The design principle: **explicit couplings are acceptable; silent
duplication is not.**

## @uvrn/drift → @uvrn/score

`@uvrn/drift` imports `WEIGHTS` from `@uvrn/score` in both `src/index.ts` and
`src/agent-api.ts` to recompute V-Score with decayed freshness. This is a peer
dependency. `@uvrn/score` is the single source of truth for V-Score weights —
`@uvrn/drift` must not redefine them.

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
