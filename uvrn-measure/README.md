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

### Operator note: host-configurable `agreeThreshold`

`agree` and `potential` read `context.agreeThreshold` on each evaluate call. The package default is **`0.9`** and is **not** silently lowered to pass CaseBank or other diagnostics.

| Mode | Behavior |
|---|---|
| Omit `context.agreeThreshold` | Uses default `0.9` |
| Set `context.agreeThreshold` | That host value applies for that run only |
| Change the package default | **Out of scope** — do not retune `DEFAULT_AGREE_THRESHOLD` to absorb known diagnostic fails |

Hosts that need a looser or tighter band for a specific product surface pass an explicit override. Improving range / conflict / potential quality for messy forecasts should use **typed observations** (`quantityKind`, declared UCUM `unit`, field, dates on `MeasurementSource.attributes` per `SPEC/uvrn-typed-observation-v1.md`) — **not** prose or title scrape, and **not** a global default soften.

```typescript
import { agreeMeasurement, withTypedObservation } from '@uvrn/measure';

const sources = [
  withTypedObservation(
    { id: 'a', kind: 'numeric', value: 100 },
    { quantityKind: 'money', unit: 'USD', unitSource: 'declared', field: 'revenue' }
  ),
  withTypedObservation(
    { id: 'b', kind: 'numeric', value: 120 },
    { quantityKind: 'money', unit: 'USD', unitSource: 'declared', field: 'revenue' }
  ),
];

// Same typed pair, two host policies — default 0.9 stays unless the host opts in.
agreeMeasurement.evaluate({ claim: '…', sources, context: { agreeThreshold: 0.75 } });
agreeMeasurement.evaluate({ claim: '…', sources, context: { agreeThreshold: 0.95 } });
```

`withTypedObservation` only merges host-declared axes into `attributes`. It never invents `quantityKind` or units from claim text or titles.

**D5 forecast realism:** eight additive short-horizon market goldens live in `SPEC/vectors/typed-observation-forecast-realism.json` and `uvrn-case-bank/fixtures/forecast-realism/` — exercised by `tests/forecast-realism-goldens.test.ts`. Default thresholds stay; CaseBank frozen baseline is untouched.

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
