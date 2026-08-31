# @uvrn/consensus

`@uvrn/consensus` turns raw farm output into a `DeltaBundle` that `@uvrn/core` can validate and score. It parses numeric evidence from provider-agnostic `FarmResult` input, ranks usable sources, deduplicates near-identical evidence, and emits a bundle with one `DataSpec` per retained source.

## Minimal install

```bash
npm install @uvrn/consensus @uvrn/core @uvrn/agent
```

`@uvrn/core` and `@uvrn/agent` are required peer dependencies. `@uvrn/farm` is optional and only needed if you want to fetch sources with a farm connector before passing them into the engine.

## Usage

```ts
import { ConsensusEngine } from '@uvrn/consensus';

const engine = new ConsensusEngine({
  sources: farmResult,
  weights: { credibility: 0.4, recency: 0.3, coverage: 0.3 },
});

const bundle = engine.buildBundle('claim: Exchange X holds full reserves');
const stats = engine.stats();

const result = engine.buildConsensusResult('claim: Exchange X holds full reserves');
// result.bundle → @uvrn/core runDeltaEngine()
// result.components → @uvrn/score ScoreBreakdown()
```

## Ranking model

Source weighting in this package is separate from the canonical V-Score formula, whose weights live in `@uvrn/core` (`VSCORE_WEIGHTS`, re-exported by `@uvrn/score` as `WEIGHTS`).

This v1 implementation ranks sources with a weighted sum:

`credibilityScore * credibilityWeight + recencyScore * recencyWeight + coverageScore * coverageWeight`

- `credibilityScore`: normalized source credibility on a 0-100 scale
- `recencyScore`: linear 30-day freshness score relative to `fetchedAt`
- `coverageScore`: percentage of input sources that produced usable numeric evidence

## Parsing and deduplication

- Numeric evidence is extracted from the first numeric token found in a source title or snippet.
- Units are inferred from nearby symbols and keywords when possible.
- Near-identical sources are collapsed when values are within 1% and timestamps are within 24 hours (configurable — see `DedupConfig` below).
- If fewer than two usable numeric sources remain after parsing and deduplication, `buildBundle()` throws `ConsensusError`.

### `DedupConfig`

The dedup thresholds are configurable via the optional `dedup` field on `ConsensusEngineOptions`. The defaults preserve the historical behavior exactly, and are regression-tested against it.

```ts
const engine = new ConsensusEngine({
  sources: farmResult,
  dedup: {
    relativeTolerance: 0.01,   // default 0.01 (±1% in 'relative' mode; absolute delta in 'absolute' mode)
    timeWindowMs: 86_400_000,  // default 1 day
    mode: 'relative',          // 'relative' (default) | 'absolute' | 'off'
  },
});
```

- `'relative'` (default): sources match when `|a − b| / max(|a|, |b|, 1) <= relativeTolerance` and timestamps are within `timeWindowMs`.
- `'absolute'`: sources match when `|a − b| <= relativeTolerance` (read as an absolute delta) and timestamps are within `timeWindowMs`.
- `'off'`: deduplication is disabled — every parsed source is retained.

## Output contract

Each retained source becomes a `DataSpec` with:

- `sourceKind: 'metric'`
- one `MetricPoint` using key `consensus_value`
- `originDocIds` seeded from the source URL

The emitted `DeltaBundle` uses `thresholdPct: 0.10` and `maxRounds: 5`.

## Stats

`stats()` returns:

- `sourceCount`
- `agreementScore`
- `coverageScore`
- `recencyScore`
- `weightedConsensusScore`
- `summary`

The `summary` field is intentionally short and verbatim-ready for logs or LLM responses.

## Public API

- `ConsensusEngine`
- `ConsensusEngine.buildConsensusResult()`
- `ConsensusResult`
- `ConsensusError`
- `SourceWeights`
- `DedupConfig`
- `ConsensusEngineOptions`
- `ConsensusStats`
- `RankedSource`
- `reportSpread` / `calculateClassPartitionedAgreement` / role helpers (Spread pillar)

### Named spread readout — `reportSpread`

Host-facing **spread** capability (BP-v2.1-Spread): label + organize claim-relative roles, compute **class-partitioned** within-role agreement (C-2), and return a signed cross-role divergence readout (C-3) with **magnitude** and **sign**.

**EvidenceClass home:** the `EvidenceClass` string union is **mirrored** in `@uvrn/consensus` (aligned with `@uvrn/lattice`) so this additive readout does not add a lattice peer. Keep the unions in sync when lattice taxonomy changes.

**Role is claim-relative:** the host declares (or assumes-with-why) role per claim; optional `claimId` is host bookkeeping. Packages do not invent a global source→role registry.

```ts
import { reportSpread } from '@uvrn/consensus';

const readout = reportSpread([
  {
    id: 'pinterest',
    metricValue: 100,
    originId: 'pin',
    role: { provenance: 'declared', evidenceClass: 'attention' },
  },
  {
    id: 'etsy',
    metricValue: 10,
    originId: 'etsy',
    role: { provenance: 'declared', evidenceClass: 'supply_entry' },
  },
]);
// readout.magnitude, readout.sign, readout.signedDivergence
// incomplete axis → magnitude/sign are null (withheld), distinct from balanced 0/0
```

**Magnitude defaults:** `demandClass=attention`, `supplyClass=supply_entry`; per-class representative = mean of first-seen `metricValue` per `originId`; `magnitude = |demand−supply| / max((|d|+|s|)/2, 1e-9)`; `sign = sign(demand−supply)`. C-2 field `multipleClassesPresent` means 2+ class partitions exist — not a measured numeric gap (use `reportSpread` for that).

Honest vocabulary: divergence **state** only — not an opportunity/accuracy score and not a market verdict. Missing roles label as `no_role` / `unknown` (incomplete assumed is a separate organize bucket); assumed roles require `why`. Existing `calculateOriginAgreementScore` / engine parity semantics are unchanged.

## Dependencies

- Peer dependencies: `@uvrn/core`, `@uvrn/agent`
- Optional peer usage: `@uvrn/farm`
- Runtime dependencies: none
