# @uvrn/measure

Pluggable relationship measurements for UVRN evidence. This package implements the first-party `agree`, `disagree`, `conflict`, and `potential` modules over the `Measurement` contract exported by `@uvrn/core`.

**Package provides:** first-party measurement objects, `MeasurementRegistry`, `defaultRegistry`, and convenience re-exports of the core measurement types. Pure logic only: no storage, signer, network call, or provider default.

**You provide:** a claim, evidence sources, and optional measurement context such as thresholds or agreement history.

## Install

```bash
npm install @uvrn/measure @uvrn/core
```

Or with pnpm:

```bash
pnpm add @uvrn/measure @uvrn/core
```

## Measurements

- **Agree:** emits `agree` when comparable sources converge at or above `context.agreeThreshold` (default `0.9`), otherwise `no-agreement`. Fewer than two comparable sources emits `insufficient-data`.
- **Disagree:** emits `disagree` when numeric spread exceeds `context.divergenceThreshold` (default `0.1`), otherwise `none`. Pure numeric spread is never `conflict`. Fewer than two numeric values emits `insufficient-data`.
- **Conflict:** emits `conflict` when two sources on the same field assert mutually exclusive categorical/boolean values or ranges separated by more than `context.conflictRangeTolerance` (default `0`), otherwise `none`. Fewer than two categorical, boolean, or range assertions emits `insufficient-data`.
- **Potential:** emits `potential` when at least `context.minObservations` (default `3`) agreement observations are rising over the last `context.windowSize` (default `3`) points but still below the agree threshold. Confidence is scaled by sample size and trend strength; thin history or a signal below `context.confidenceFloor` (default `0.25`) emits `insufficient-data` so weak early signals are never overstated.

Every measurement emits `insufficient-data` per `SPEC/uvrn-measurement-v1.md` §4 when it cannot measure, with an explanation stating what was missing. UIs should render it as "Not enough evidence", never as agreement or as an error.

### Context keys

| Key | Default | Used by |
|---|---|---|
| `agreeThreshold` | `0.9` | agree, potential |
| `divergenceThreshold` | `0.1` | disagree |
| `conflictRangeTolerance` | `0` | conflict |
| `minObservations` | `3` | potential |
| `windowSize` | `3` | potential |
| `history` / `agreementHistory` | — | potential (scores 0..1, oldest first) |
| `confidenceFloor` | `0.25` | potential |

## Usage

```typescript
import { defaultRegistry } from '@uvrn/measure';

const registry = defaultRegistry();

const results = registry.runAll({
  claim: 'Two sources report similar revenue.',
  sources: [
    { id: 'source-a', kind: 'numeric', value: 100, label: 'Source A' },
    { id: 'source-b', kind: 'numeric', value: 104, label: 'Source B' },
  ],
  context: {
    agreeThreshold: 0.9,
    divergenceThreshold: 0.1,
    history: [0.55, 0.62, 0.74],
  },
});
```

## Custom measurements

Core owns the interface; this package owns starter implementations. A host can add or replace measurement logic by implementing `Measurement` and registering it.

```typescript
import { Measurement, MeasurementRegistry } from '@uvrn/measure';

const customMeasurement: Measurement = {
  type: 'custom',
  evaluate(input) {
    return {
      type: 'custom',
      verdict: input.sources.length > 0 ? 'observed' : 'none',
      confidence: input.sources.length > 0 ? 1 : 0,
      explanation: 'Custom measurement checked whether any evidence was present.',
      evidenceRefs: input.sources.map((source) => source.id),
    };
  },
};

const registry = new MeasurementRegistry();
registry.register(customMeasurement);
```

## Package Boundary

`@uvrn/measure` depends only on the shared measurement contract from `@uvrn/core`. Hosts can adapt consensus, compare, drift, or other package outputs into measurement input before calling this package, but v1 ships no adapter-backed peer surface.

## Links

Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).
