# @uvrn/drift

Temporal decay scoring for [UVRN](https://uvrn.org) verification receipts.

Models how a claim's confidence score degrades over time using configurable decay curves — because a receipt from 6 hours ago on a fast-moving claim shouldn't carry the same weight as one from 6 minutes ago.

**Package provides:** `computeDrift`, `DriftMonitor`, `computeDriftFromInput`; built-in profiles and decay curves; types (`DriftReceipt`, `DriftSnapshot`, `AgentDriftReceipt`, etc.). Score-to-status (STABLE / DRIFTING / CRITICAL).

**You provide:** Receipt (or drift input) to score; optionally your own decay profile. No storage — you consume threshold events (e.g. alert, feed agent/canon).

## Install

```bash
npm install @uvrn/drift
```

## Quick start

```ts
import { computeDrift, DRIFT_PROFILES } from '@uvrn/drift';

const result = computeDrift(receipt, DRIFT_PROFILES.fast);

console.log(result.drift.decayed_score); // e.g. 61 (was 88, 24h ago)
console.log(result.drift.status);        // 'DRIFTING'
console.log(result.drift.delta);         // -27
```

## Decay curves

| Curve | Behaviour | Good for |
|---|---|---|
| `LINEAR` | Fixed pts/hr drop | Slow-moving, long-lived claims |
| `SIGMOID` | Holds, then hard drop at midpoint | Claims with binary freshness — current or not |
| `EXPONENTIAL` | Immediate aggressive decay | Fast-moving claims, volatile data |

## Built-in profiles

`fast` · `moderate` · `threshold_short` · `threshold_long` · `slow` · `archival` · `default`

These are generic starting points covering each curve type at different speeds. Build your own `DriftProfile` for domain-specific tuning:

```ts
import type { DriftProfile } from '@uvrn/drift';

const myCustomProfile: DriftProfile = {
  name: 'my_domain_profile',
  curve: 'SIGMOID',
  rate: 48,               // midpoint at 48 hours
  staleAfterHours: 120,
  scoreFloor: 10,
};

const result = computeDrift(receipt, myCustomProfile);
```

## Continuous monitoring

```ts
import { DriftMonitor, DRIFT_PROFILES } from '@uvrn/drift';

const monitor = new DriftMonitor({
  intervalMs: 60_000, // check every minute
  onThreshold: (event) => {
    console.log(`${event.receipt_id}: ${event.from} → ${event.to}`);
    // emit alert receipt, notify @uvrn/agent, etc.
  },
});

monitor.watch(receipt, DRIFT_PROFILES.threshold_short);
monitor.start();
```

## V-Score formula

```
V-Score = (Completeness × 0.35) + (Parity × 0.35) + (Freshness × 0.30)
```

Drift decays the **Freshness** component only. Completeness and Parity
are re-scored by `@uvrn/agent` when new sources are fetched.

## License

MIT · [uvrn.org](https://uvrn.org)
