# @uvrn/signal

`@uvrn/signal` is the UVRN protocol's typed in-process event bus. It gives packages and applications a small pub/sub layer with a stable event map so drift, canon, agent, and watch can communicate without hard wiring themselves to one another.

## Minimal install

```bash
npm install @uvrn/signal
```

No other `@uvrn/*` packages are required. `@uvrn/signal` has zero runtime dependencies.

## Usage

```ts
import { SignalBridge, SignalBus } from '@uvrn/signal';

const busA = new SignalBus();
const busB = new SignalBus();

busA.on('drift:threshold', (event) => {
  console.log(event.claimId, event.snapshot.adjustedScore);
});

const bridge = new SignalBridge(busA, busB);
bridge.connect('drift:threshold');

busB.on('drift:threshold', (event) => {
  console.log('Forwarded to busB:', event.status);
});

busA.emit('drift:threshold', {
  claimId: 'clm_sol_001',
  status: 'DRIFTING',
  snapshot: {
    adjustedScore: 67.4,
    freshness: 52,
    decayRate: 0.35,
    timestamp: Date.now(),
  },
});
```

## Typed Event Map

The typed event map is the package's core value. `SignalBus` uses `UVRNEventMap` by default so each event key narrows its payload automatically.

```ts
import { SignalBus } from '@uvrn/signal';

const bus = new SignalBus();

bus.on('canon:suggested', (event) => {
  event.receiptId;
  event.score;
});
```

## Extending the Bus

`SignalBus` accepts a custom event map generic so applications can add or replace events without losing type inference.

```ts
import { SignalBus, type UVRNEventMap } from '@uvrn/signal';

interface AppEvents extends UVRNEventMap {
  'custom:ping': { id: string; ok: boolean };
}

const bus = new SignalBus<AppEvents>();
bus.emit('custom:ping', { id: 'ping-1', ok: true });
```

## SignalBridge

`SignalBridge` forwards selected events from one `SignalBus` to another. This is useful for worker-to-client, service-to-service, or adapter-to-app forwarding inside the same process boundary.

## Public API

- `SignalBus`
- `SignalBridge`
- `UVRNEventMap`
- `DriftThresholdEvent`
- `DriftStableEvent`
- `CanonSuggestionEvent`
- `CanonizedEvent`
- `AgentReceiptEvent`
- `AgentRegisteredEvent`
- `AgentStoppedEvent`
- `WatchAlertEvent`
- `WatchCooldownEvent`
- `SignalEventMap`
- `SignalEventKey`
- `SignalHandler`

## Dependencies

- Runtime dependencies: none
- Peer dependencies: none
