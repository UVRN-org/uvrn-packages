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
} from '../types';
import { DiscordDelivery } from './delivery/DiscordDelivery';
import { SlackDelivery } from './delivery/SlackDelivery';
import { WebhookDelivery } from './delivery/WebhookDelivery';
import { isInCooldown, resolveCooldown } from './cooldown';

interface SubscriptionRecord extends Subscription {
  statuses: Set<AlertStatus>;
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

function buildTargets(notify: NotifyTargets, event: AlertEvent): Array<Promise<void>> {
  const deliveries: Array<Promise<void>> = [];

  if (notify.callback) {
    deliveries.push(Promise.resolve().then(() => notify.callback?.(event)));
  }

  if (notify.webhook) {
    deliveries.push(new WebhookDelivery(notify.webhook).deliver(event));
  }

  if (notify.slack) {
    deliveries.push(new SlackDelivery(notify.slack).deliver(event));
  }

  if (notify.discord) {
    deliveries.push(new DiscordDelivery(notify.discord).deliver(event));
  }

  const customTargets = Array.isArray(notify.targets)
    ? notify.targets
    : notify.targets
      ? [notify.targets]
      : [];

  customTargets.forEach((target: DeliveryTarget) => {
    deliveries.push(target.deliver(event));
  });

  return deliveries;
}

export class Watcher {
  private readonly agent: ThresholdAgent;
  private readonly subscriptionsById = new Map<string, SubscriptionRecord>();
  private readonly thresholdHandler = (event: DriftThresholdEvent): void => {
    void this.handleThreshold(event);
  };

  constructor(options: WatcherOptions) {
    if (!isThresholdAgent(options.agent)) {
      throw new Error('Watcher requires an agent with .on(\'claim:threshold\', handler)');
    }

    this.agent = options.agent;
    this.agent.on('claim:threshold', this.thresholdHandler);
  }

  subscribe(claimId: string, options: SubscribeOptions): Subscription {
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
        removed = true;
      }
    }

    return removed;
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
    }

    const results = await Promise.allSettled(buildTargets(record.options.notify, alertEvent));

    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error(
          `[uvrn/watch] delivery failed for ${record.subscriberId}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
      }
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
