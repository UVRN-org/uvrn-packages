import type { DriftThresholdEvent } from '@uvrn/drift';
import type {
  AlertEvent,
  AlertStatus,
  DeliveryTarget,
  NotifyTargets,
  SubscribeOptions,
  Subscription,
  ThresholdAgent,
  WatcherOptions,
  WatchStore,
} from '../types';
import { InMemoryWatchStore } from '../store/InMemoryWatchStore';
import { DiscordDelivery } from './delivery/DiscordDelivery';
import { SlackDelivery } from './delivery/SlackDelivery';
import { WebhookDelivery } from './delivery/WebhookDelivery';
import { isInCooldown, resolveCooldown } from './cooldown';

interface SubscriptionRecord extends Subscription {
  statuses: Set<AlertStatus>;
}

interface RetryConfig {
  retryAttempts: number;
  retryBackoffMs: number;
  sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_BACKOFF_MS = 250;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function assertValidWebhookUrl(url: string, label: string): void {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[uvrn/watch] invalid ${label} URL "${url}": not a parseable URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `[uvrn/watch] invalid ${label} URL "${url}": protocol must be http or https, got ${parsed.protocol}`
    );
  }
}

async function deliverWithRetry(attempt: () => Promise<void>, retry: RetryConfig): Promise<void> {
  let lastError: unknown;

  for (let attemptNumber = 0; attemptNumber <= retry.retryAttempts; attemptNumber += 1) {
    if (attemptNumber > 0) {
      await retry.sleep(retry.retryBackoffMs * 2 ** (attemptNumber - 1));
    }

    try {
      await attempt();
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `delivery failed after ${retry.retryAttempts + 1} attempt(s): ${toErrorMessage(lastError)}`
  );
}

let sequence = 0;

function nextSubscriberId(): string {
  sequence += 1;
  return `sub_${String(sequence).padStart(4, '0')}`;
}

function isThresholdAgent(agent: unknown): agent is ThresholdAgent {
  return typeof agent === 'object' && agent !== null && typeof (agent as ThresholdAgent).on === 'function';
}

function isAlertStatus(status: string): status is AlertStatus {
  return status === 'DRIFTING' || status === 'CRITICAL';
}

function normalizeStatuses(on: SubscribeOptions['on']): Set<AlertStatus> {
  const values = Array.isArray(on) ? on : [on];
  return new Set(values.filter(isAlertStatus));
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatDelta(value: number): string {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return value > 0 ? `+${normalized}` : normalized;
}

function resolveClaimId(event: DriftThresholdEvent): string | null {
  return event.claimId ?? event.receiptId ?? event.receipt_id ?? null;
}

function buildAlertEvent(event: DriftThresholdEvent, subscriberId: string): AlertEvent | null {
  const claimId = resolveClaimId(event);
  if (!claimId || !isAlertStatus(event.to)) {
    return null;
  }

  const triggeredAt = event.crossedAt ?? event.at;
  const vScore = event.vScore ?? event.score;
  const driftDelta = event.delta;

  return {
    claimId,
    status: event.to,
    vScore,
    driftDelta,
    triggeredAt,
    subscriberId,
    summary: `Claim ${claimId} entered ${event.to} status at V-Score ${formatScore(vScore)} (delta ${formatDelta(driftDelta)}) at ${triggeredAt}.`,
  };
}

function buildTargets(notify: NotifyTargets, event: AlertEvent, retry: RetryConfig): Array<Promise<void>> {
  const deliveries: Array<Promise<void>> = [];

  if (notify.callback) {
    deliveries.push(Promise.resolve().then(() => notify.callback?.(event)));
  }

  if (notify.webhook) {
    const delivery = new WebhookDelivery(notify.webhook);
    deliveries.push(deliverWithRetry(() => delivery.deliver(event), retry));
  }

  if (notify.slack) {
    const delivery = new SlackDelivery(notify.slack);
    deliveries.push(deliverWithRetry(() => delivery.deliver(event), retry));
  }

  if (notify.discord) {
    const delivery = new DiscordDelivery(notify.discord);
    deliveries.push(deliverWithRetry(() => delivery.deliver(event), retry));
  }

  const customTargets = Array.isArray(notify.targets)
    ? notify.targets
    : notify.targets
      ? [notify.targets]
      : [];

  customTargets.forEach((target: DeliveryTarget) => {
    deliveries.push(deliverWithRetry(() => target.deliver(event), retry));
  });

  return deliveries;
}

export class Watcher {
  private readonly agent: ThresholdAgent;
  private readonly store: WatchStore;
  private readonly retryAttempts: number;
  private readonly retryBackoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly subscriptionsById = new Map<string, SubscriptionRecord>();
  private persistTail: Promise<void> = Promise.resolve();
  private readonly thresholdHandler = (event: DriftThresholdEvent): void => {
    void this.handleThreshold(event);
  };

  constructor(options: WatcherOptions) {
    if (!isThresholdAgent(options.agent)) {
      throw new Error('Watcher requires an agent with .on(\'claim:threshold\', handler)');
    }

    this.agent = options.agent;
    this.store = options.store ?? new InMemoryWatchStore();
    this.retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.agent.on('claim:threshold', this.thresholdHandler);
  }

  subscribe(claimId: string, options: SubscribeOptions): Subscription {
    if (options.notify.webhook) {
      assertValidWebhookUrl(options.notify.webhook, 'webhook');
    }
    if (options.notify.slack) {
      assertValidWebhookUrl(options.notify.slack, 'slack webhook');
    }
    if (options.notify.discord) {
      assertValidWebhookUrl(options.notify.discord, 'discord webhook');
    }

    const subscriberId = nextSubscriberId();
    const record: SubscriptionRecord = {
      claimId,
      options: {
        ...options,
        mode: options.mode ?? 'every',
        cooldown: resolveCooldown(options.cooldown),
      },
      subscriberId,
      alertCount: 0,
      active: true,
      statuses: normalizeStatuses(options.on),
    };

    this.subscriptionsById.set(subscriberId, record);
    this.queuePersist(() => this.store.saveSubscription(this.toSubscription(record)));
    return this.toSubscription(record);
  }

  subscriptions(): Subscription[] {
    return Array.from(this.subscriptionsById.values())
      .filter((subscription) => subscription.active)
      .map((subscription) => this.toSubscription(subscription));
  }

  unsubscribe(target: string): boolean {
    let removed = false;

    for (const [subscriberId, record] of this.subscriptionsById) {
      if (record.subscriberId === target || record.claimId === target) {
        this.subscriptionsById.delete(subscriberId);
        this.queuePersist(() => this.store.removeSubscription(subscriberId));
        removed = true;
      }
    }

    return removed;
  }

  /**
   * Resolves once all queued store writes have settled. Useful for callers
   * (and tests) that need the injected `WatchStore` to reflect the latest
   * subscribe/unsubscribe/alert bookkeeping before reading from it.
   */
  async flush(): Promise<void> {
    await this.persistTail;
  }

  stop(): void {
    if (this.agent.off) {
      this.agent.off('claim:threshold', this.thresholdHandler);
    } else if (this.agent.removeListener) {
      this.agent.removeListener('claim:threshold', this.thresholdHandler);
    }

    this.subscriptionsById.clear();
  }

  private async handleThreshold(event: DriftThresholdEvent): Promise<void> {
    const claimId = resolveClaimId(event);
    if (!claimId || !isAlertStatus(event.to)) {
      return;
    }
    const status = event.to;

    const now = Date.now();
    const matching = Array.from(this.subscriptionsById.values()).filter((record) => {
      if (!record.active || record.claimId !== claimId) {
        return false;
      }

      if (!record.statuses.has(status)) {
        return false;
      }

      return !isInCooldown(record.lastAlertAt, resolveCooldown(record.options.cooldown), now);
    });

    await Promise.all(matching.map((record) => this.dispatchAlert(record, event, now)));
  }

  private async dispatchAlert(
    record: SubscriptionRecord,
    event: DriftThresholdEvent,
    now: number
  ): Promise<void> {
    const alertEvent = buildAlertEvent(event, record.subscriberId);
    if (!alertEvent) {
      return;
    }

    record.lastAlertAt = now;
    record.alertCount += 1;

    if (record.options.mode === 'once') {
      record.active = false;
      this.subscriptionsById.delete(record.subscriberId);
      this.queuePersist(() => this.store.removeSubscription(record.subscriberId));
    } else {
      this.queuePersist(() => this.store.saveSubscription(this.toSubscription(record)));
    }

    const retry: RetryConfig = {
      retryAttempts: record.options.retryAttempts ?? this.retryAttempts,
      retryBackoffMs: record.options.retryBackoffMs ?? this.retryBackoffMs,
      sleep: this.sleep,
    };

    const results = await Promise.allSettled(buildTargets(record.options.notify, alertEvent, retry));

    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error(
          `[uvrn/watch] delivery failed for ${record.subscriberId}: ${toErrorMessage(result.reason)}`
        );
      }
    });
  }

  private queuePersist(operation: () => Promise<unknown>): void {
    this.persistTail = this.persistTail
      .then(operation)
      .then(() => undefined)
      .catch((err) => {
        console.error(`[uvrn/watch] store operation failed: ${toErrorMessage(err)}`);
      });
  }

  private toSubscription(record: SubscriptionRecord): Subscription {
    return {
      claimId: record.claimId,
      options: {
        ...record.options,
        on: Array.isArray(record.options.on) ? [...record.options.on] : record.options.on,
        notify: { ...record.options.notify },
      },
      subscriberId: record.subscriberId,
      lastAlertAt: record.lastAlertAt,
      alertCount: record.alertCount,
      active: record.active,
    };
  }
}
