import type { Subscription, WatchStore } from '../types';

/**
 * Default zero-dependency `WatchStore` backed by a `Map`.
 *
 * Used by the `Watcher` when no store is injected, preserving the package's
 * historical in-memory behavior. Durable implementations (e.g.
 * `SqliteWatchStore` in a reference-store package) implement the same
 * interface and are injected via `WatcherOptions.store`.
 */
export class InMemoryWatchStore implements WatchStore {
  private readonly subscriptions = new Map<string, Subscription>();

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.subscriberId, { ...subscription });
  }

  async getSubscription(subscriberId: string): Promise<Subscription | null> {
    const subscription = this.subscriptions.get(subscriberId);
    return subscription ? { ...subscription } : null;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).map((subscription) => ({ ...subscription }));
  }

  async removeSubscription(subscriberId: string): Promise<boolean> {
    return this.subscriptions.delete(subscriberId);
  }
}
