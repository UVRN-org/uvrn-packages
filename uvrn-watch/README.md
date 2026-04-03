# @uvrn/watch

`@uvrn/watch` turns `@uvrn/agent` threshold events into subscriber-facing alerts. The package owns alert matching, cooldown, deduplication, and once-versus-every delivery behavior. Delivery is pluggable.

## Minimal install

```bash
npm install @uvrn/watch @uvrn/agent @uvrn/drift
```

## Usage

```ts
import { Watcher } from '@uvrn/watch';

const watcher = new Watcher({ agent });

watcher.subscribe('clm_sol_001', {
  on: 'CRITICAL',
  notify: {
    callback: (event) => {
      console.log(event.summary);
    },
  },
  mode: 'once',
  cooldown: 300_000,
});
```

## DeliveryTarget contract

`DeliveryTarget` is the protocol contract for custom delivery channels:

```ts
interface DeliveryTarget {
  deliver(event: AlertEvent): Promise<void>;
}
```

Implement it for email, PagerDuty, SMS, or any internal system. `@uvrn/watch` owns when an alert fires. You own where it goes.

Custom targets can be attached directly on subscribe:

```ts
watcher.subscribe('clm_sol_001', {
  on: 'CRITICAL',
  notify: {
    targets: [new PagerDutyDelivery(), new EmailDelivery()],
  },
});
```

## Zero-dependency path

The `callback` notify target is the primary zero-external path. It works entirely in-process and requires no third-party service, webhook registration, or account setup.

## Reference implementations

These are included as working examples and are optional:

| Implementation | Purpose |
| --- | --- |
| `WebhookDelivery` | POSTs the full `AlertEvent` JSON body to any HTTP endpoint |
| `SlackDelivery` | POSTs `event.summary` to a Slack incoming webhook URL |
| `DiscordDelivery` | POSTs `event.summary` to a Discord webhook URL |

## Alert behavior

- `mode: 'once'` fires exactly once and deactivates that subscription
- `mode: 'every'` fires on each matching threshold event after cooldown expires
- Default cooldown is 5 minutes
- Subscriptions can match `DRIFTING`, `CRITICAL`, or both

## Public API

- `Watcher`
- `DeliveryTarget`
- `NotifyTargets`
- `SubscribeOptions`
- `AlertEvent`
- `WatcherOptions`
- `Subscription`
- `WebhookDelivery`
- `SlackDelivery`
- `DiscordDelivery`

## Dependencies

- Peer dependencies: `@uvrn/agent`, `@uvrn/drift`
- Runtime dependencies: none
