import type { DriftStatus, DriftThresholdEvent } from '@uvrn/drift';

export type AlertStatus = Extract<DriftStatus, 'DRIFTING' | 'CRITICAL'>;
export type AlertMode = 'once' | 'every';

export interface DeliveryTarget {
  deliver(event: AlertEvent): Promise<void>;
}

export interface NotifyTargets {
  callback?: (event: AlertEvent) => void;
  webhook?: string;
  slack?: string;
  discord?: string;
  targets?: DeliveryTarget | DeliveryTarget[];
}

export interface SubscribeOptions {
  on: AlertStatus | AlertStatus[];
  notify: NotifyTargets;
  mode?: AlertMode;
  cooldown?: number;
  /**
   * Maximum delivery retries after the initial attempt for this subscription.
   * Overrides the watcher-level `retryAttempts`. Default 3.
   */
  retryAttempts?: number;
  /**
   * Initial retry backoff in milliseconds for this subscription, doubling on
   * each subsequent retry. Overrides the watcher-level `retryBackoffMs`.
   * Default 250.
   */
  retryBackoffMs?: number;
}

export interface AlertEvent {
  claimId: string;
  status: AlertStatus;
  vScore: number;
  driftDelta: number;
  triggeredAt: string;
  subscriberId: string;
  summary: string;
}

export interface WatcherOptions {
  agent: unknown;
  /**
   * Optional persistence seam for subscriptions. Every subscription mutation
   * (subscribe, unsubscribe, alert bookkeeping) is written through this store.
   * Defaults to an `InMemoryWatchStore`, preserving the existing in-memory
   * behavior. Inject a durable implementation (e.g. a SQLite-backed store)
   * to persist subscriptions across restarts.
   */
  store?: WatchStore;
  /**
   * Default maximum delivery retries after the initial attempt, applied to
   * webhook/Slack/Discord and custom `DeliveryTarget` deliveries.
   * Per-subscription `retryAttempts` overrides this. Default 3.
   */
  retryAttempts?: number;
  /**
   * Default initial retry backoff in milliseconds, doubling on each
   * subsequent retry. Per-subscription `retryBackoffMs` overrides this.
   * Default 250.
   */
  retryBackoffMs?: number;
  /**
   * Injectable async sleep used between delivery retries. Tests can stub
   * this to avoid real backoff delays. Defaults to a `setTimeout`-based wait.
   */
  sleep?: (ms: number) => Promise<void>;
}

export interface Subscription {
  claimId: string;
  options: SubscribeOptions;
  subscriberId: string;
  lastAlertAt?: number;
  alertCount: number;
  active: boolean;
}

/**
 * Pluggable persistence seam for watcher subscriptions.
 *
 * The `Watcher` writes every subscription mutation through this interface so
 * durable implementations (e.g. SQLite-backed stores) can persist
 * subscriptions across restarts. The default `InMemoryWatchStore` keeps the
 * existing in-memory behavior. Implementations are injected — this package
 * ships no storage of its own.
 *
 * Note: `notify.callback` functions and custom `DeliveryTarget` instances are
 * not serializable; durable stores should persist URL-based targets only.
 */
export interface WatchStore {
  /** Create or update a subscription record, keyed by `subscriberId`. */
  saveSubscription(subscription: Subscription): Promise<void>;
  /** Fetch a single subscription by subscriber id, or `null` when absent. */
  getSubscription(subscriberId: string): Promise<Subscription | null>;
  /** List all stored subscriptions. */
  listSubscriptions(): Promise<Subscription[]>;
  /** Remove a subscription by subscriber id; resolves `true` when one was removed. */
  removeSubscription(subscriberId: string): Promise<boolean>;
}

export interface ThresholdAgent {
  on(event: 'claim:threshold', listener: (event: DriftThresholdEvent) => void): unknown;
  off?(event: 'claim:threshold', listener: (event: DriftThresholdEvent) => void): unknown;
  removeListener?(event: 'claim:threshold', listener: (event: DriftThresholdEvent) => void): unknown;
}
