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

## Delivery retry

Webhook, Slack, Discord, and custom `DeliveryTarget` deliveries are retried with exponential backoff when they throw or reject. Defaults: 3 retries after the initial attempt, starting at 250 ms and doubling per retry. After the final failure the watcher reports the exhausted delivery via its existing error path (`console.error`), so failures are never silently swallowed. The in-process `callback` target is not retried.

```ts
// Watcher-level defaults
const watcher = new Watcher({
  agent,
  retryAttempts: 5,     // retries after the initial attempt (default 3)
  retryBackoffMs: 500,  // initial backoff, doubles per retry (default 250)
  sleep: customSleep,   // injectable await between retries (handy in tests)
});

// Per-subscription override
watcher.subscribe('clm_sol_001', {
  on: 'CRITICAL',
  notify: { webhook: 'https://example.com/hook' },
  retryAttempts: 1,
  retryBackoffMs: 100,
});
```

## Webhook URL validation

`webhook`, `slack`, and `discord` notify targets are validated when the subscription is created. URLs that cannot be parsed by `new URL()` or whose protocol is not `http:`/`https:` are rejected with a clear error, and the subscription is not registered.

## Persistence: `WatchStore`

`WatchStore` is the injectable persistence seam for subscriptions. The `Watcher` writes every subscription mutation (subscribe, unsubscribe, alert bookkeeping, once-mode removal) through the store. This package ships no storage of its own — stores are injected interfaces; the default `InMemoryWatchStore` preserves the historical in-memory behavior.

```ts
interface WatchStore {
  saveSubscription(subscription: Subscription): Promise<void>;
  getSubscription(subscriberId: string): Promise<Subscription | null>;
  listSubscriptions(): Promise<Subscription[]>;
  removeSubscription(subscriberId: string): Promise<boolean>;
}
```

Inject a durable implementation (e.g. a SQLite-backed store from a reference-store package) to persist subscriptions across restarts:

```ts
const watcher = new Watcher({ agent, store: new SqliteWatchStore(db) });
```

Store writes are queued in order; `await watcher.flush()` resolves once all pending store writes have settled. Note that `notify.callback` functions and custom `DeliveryTarget` instances are not serializable — durable stores should persist URL-based targets only.

## Public API

- `Watcher`
- `DeliveryTarget`
- `NotifyTargets`
- `SubscribeOptions`
- `AlertEvent`
- `WatcherOptions`
- `Subscription`
- `WatchStore`
- `InMemoryWatchStore`
- `WebhookDelivery`
- `SlackDelivery`
- `DiscordDelivery`
- `DEFAULT_RETRY_ATTEMPTS`, `DEFAULT_RETRY_BACKOFF_MS`

## Dependencies

- Peer dependencies: `@uvrn/agent`, `@uvrn/drift`
- Runtime dependencies: none
