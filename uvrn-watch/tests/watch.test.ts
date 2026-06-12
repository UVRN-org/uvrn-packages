import EventEmitter from 'events';
import { Watcher, type AlertEvent, type DeliveryTarget, type Subscription, type WatchStore } from '../src';
import type { DriftThresholdEvent } from '@uvrn/drift';

class MockAgent extends EventEmitter {}

class CapturingTarget implements DeliveryTarget {
  events: AlertEvent[] = [];

  async deliver(event: AlertEvent): Promise<void> {
    this.events.push(event);
  }
}

function buildEvent(overrides: Partial<DriftThresholdEvent> = {}): DriftThresholdEvent {
  return {
    receipt_id: 'clm_sol_001_r1',
    from: 'STABLE',
    to: 'CRITICAL',
    score: 38.2,
    delta: -14.8,
    at: '2026-04-02T12:00:00.000Z',
    claimId: 'clm_sol_001',
    receiptId: 'clm_sol_001_r1',
    vScore: 38.2,
    crossedAt: '2026-04-02T12:00:00.000Z',
    component: 'composite',
    ...overrides,
  };
}

/** Drains pending async work (retry chains run on microtasks when sleep is stubbed). */
async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const noopSleep = async (): Promise<void> => {};

class RecordingStore implements WatchStore {
  private readonly records = new Map<string, Subscription>();

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.records.set(subscription.subscriberId, { ...subscription });
  }

  async getSubscription(subscriberId: string): Promise<Subscription | null> {
    return this.records.get(subscriberId) ?? null;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.records.values());
  }

  async removeSubscription(subscriberId: string): Promise<boolean> {
    return this.records.delete(subscriberId);
  }
}

describe('@uvrn/watch', () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response) as typeof fetch;
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  it('registers a subscription and includes it in subscriptions()', () => {
    const watcher = new Watcher({ agent: new MockAgent() });

    const subscription = watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback: jest.fn() },
    });

    expect(subscription.subscriberId).toMatch(/^sub_/);
    expect(watcher.subscriptions()).toHaveLength(1);
    expect(watcher.subscriptions()[0]).toMatchObject({
      claimId: 'clm_sol_001',
      subscriberId: subscription.subscriberId,
    });
  });

  it('fires when a matching threshold event is emitted', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback },
    });

    agent.emit('claim:threshold', buildEvent());
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: 'clm_sol_001',
        status: 'CRITICAL',
        vScore: 38.2,
        driftDelta: -14.8,
      })
    );
  });

  it('does not fire for a non-matching status', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback },
    });

    agent.emit('claim:threshold', buildEvent({ to: 'DRIFTING', from: 'STABLE' }));
    await flushPromises();

    expect(callback).not.toHaveBeenCalled();
  });

  it('prevents re-firing within the cooldown window', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback },
      cooldown: 300_000,
    });

    agent.emit('claim:threshold', buildEvent());
    agent.emit('claim:threshold', buildEvent({ at: '2026-04-02T12:01:00.000Z' }));
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('mode once fires once then removes the subscription', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback },
      mode: 'once',
      cooldown: 0,
    });

    agent.emit('claim:threshold', buildEvent());
    agent.emit('claim:threshold', buildEvent({ at: '2026-04-02T12:05:00.000Z' }));
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(watcher.subscriptions()).toHaveLength(0);
  });

  it('mode every fires again after cooldown expires', async () => {
    const dateNowSpy = jest.spyOn(Date, 'now');
    const agent = new MockAgent();
    const callback = jest.fn();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback },
      mode: 'every',
      cooldown: 1000,
    });

    dateNowSpy.mockReturnValue(0);
    agent.emit('claim:threshold', buildEvent());
    await flushPromises();
    dateNowSpy.mockReturnValue(1001);
    agent.emit('claim:threshold', buildEvent({ at: '2026-04-02T12:05:00.000Z' }));
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe removes active subscriptions by subscriberId or claimId', () => {
    const watcher = new Watcher({ agent: new MockAgent() });
    const subscription = watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback: jest.fn() },
    });

    expect(watcher.unsubscribe(subscription.subscriberId)).toBe(true);
    expect(watcher.subscriptions()).toHaveLength(0);

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback: jest.fn() },
    });
    expect(watcher.unsubscribe('clm_sol_001')).toBe(true);
    expect(watcher.subscriptions()).toHaveLength(0);
  });

  it('routes alerts to callback and reference delivery targets', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const customTarget = new CapturingTarget();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: ['DRIFTING', 'CRITICAL'],
      notify: {
        callback,
        webhook: 'https://example.com/webhook',
        slack: 'https://hooks.slack.com/services/123',
        discord: 'https://discord.com/api/webhooks/123',
        targets: customTarget,
      },
      cooldown: 0,
    });

    agent.emit('claim:threshold', buildEvent());
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(customTarget.events).toHaveLength(1);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('isolates delivery failures so sibling routes still run', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const watcher = new Watcher({ agent, retryAttempts: 0 });
    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: {
        callback,
        webhook: 'https://example.com/webhook',
        slack: 'https://hooks.slack.com/services/123',
      },
      cooldown: 0,
    });

    agent.emit('claim:threshold', buildEvent());
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('stop detaches the threshold listener and clears subscriptions', async () => {
    const agent = new MockAgent();
    const callback = jest.fn();
    const watcher = new Watcher({ agent });

    watcher.subscribe('clm_sol_001', {
      on: 'CRITICAL',
      notify: { callback },
    });

    watcher.stop();
    agent.emit('claim:threshold', buildEvent());
    await flushPromises();

    expect(callback).not.toHaveBeenCalled();
    expect(watcher.subscriptions()).toHaveLength(0);
  });

  describe('delivery retry', () => {
    it('retries a flaky webhook delivery and succeeds on the 3rd attempt', async () => {
      const agent = new MockAgent();
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

      fetchMock
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

      const watcher = new Watcher({ agent, sleep: noopSleep });
      watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { webhook: 'https://example.com/webhook' },
        cooldown: 0,
      });

      agent.emit('claim:threshold', buildEvent());
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('surfaces failure after exhausting retries', async () => {
      const agent = new MockAgent();
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

      const watcher = new Watcher({ agent, retryAttempts: 2, sleep: noopSleep });
      watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { webhook: 'https://example.com/webhook' },
        cooldown: 0,
      });

      agent.emit('claim:threshold', buildEvent());
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledTimes(1);
      expect((console.error as jest.Mock).mock.calls[0][0]).toContain('after 3 attempt(s)');
    });

    it('doubles the backoff delay on each retry', async () => {
      const agent = new MockAgent();
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

      const sleeps: number[] = [];
      const watcher = new Watcher({
        agent,
        retryBackoffMs: 100,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      });

      watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { webhook: 'https://example.com/webhook' },
        cooldown: 0,
      });

      agent.emit('claim:threshold', buildEvent());
      await flushPromises();

      expect(sleeps).toEqual([100, 200, 400]);
    });

    it('honors per-subscription retry overrides', async () => {
      const agent = new MockAgent();
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

      const watcher = new Watcher({ agent, retryAttempts: 5, sleep: noopSleep });
      watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { webhook: 'https://example.com/webhook' },
        cooldown: 0,
        retryAttempts: 1,
      });

      agent.emit('claim:threshold', buildEvent());
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('webhook URL validation', () => {
    it('rejects an unparseable webhook URL at subscribe time', () => {
      const watcher = new Watcher({ agent: new MockAgent() });

      expect(() =>
        watcher.subscribe('clm_sol_001', {
          on: 'CRITICAL',
          notify: { webhook: 'not a url' },
        })
      ).toThrow(/invalid webhook URL "not a url": not a parseable URL/);
      expect(watcher.subscriptions()).toHaveLength(0);
    });

    it('rejects non-http(s) protocols across webhook, slack, and discord targets', () => {
      const watcher = new Watcher({ agent: new MockAgent() });

      expect(() =>
        watcher.subscribe('clm_sol_001', {
          on: 'CRITICAL',
          notify: { webhook: 'ftp://example.com/hook' },
        })
      ).toThrow(/protocol must be http or https/);

      expect(() =>
        watcher.subscribe('clm_sol_001', {
          on: 'CRITICAL',
          notify: { slack: 'file:///etc/passwd' },
        })
      ).toThrow(/invalid slack webhook URL/);

      expect(() =>
        watcher.subscribe('clm_sol_001', {
          on: 'CRITICAL',
          notify: { discord: 'not-a-url' },
        })
      ).toThrow(/invalid discord webhook URL/);

      expect(watcher.subscriptions()).toHaveLength(0);
    });

    it('accepts valid http and https URLs', () => {
      const watcher = new Watcher({ agent: new MockAgent() });

      expect(() =>
        watcher.subscribe('clm_sol_001', {
          on: 'CRITICAL',
          notify: {
            webhook: 'http://localhost:8080/hook',
            slack: 'https://hooks.slack.com/services/123',
          },
        })
      ).not.toThrow();
      expect(watcher.subscriptions()).toHaveLength(1);
    });
  });

  describe('WatchStore injection', () => {
    it('round-trips subscriptions through an injected store', async () => {
      const store = new RecordingStore();
      const watcher = new Watcher({ agent: new MockAgent(), store });

      const subscription = watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { callback: jest.fn() },
      });
      await watcher.flush();

      const listed = await store.listSubscriptions();
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        claimId: 'clm_sol_001',
        subscriberId: subscription.subscriberId,
        active: true,
        alertCount: 0,
      });
      expect(await store.getSubscription(subscription.subscriberId)).not.toBeNull();

      watcher.unsubscribe(subscription.subscriberId);
      await watcher.flush();

      expect(await store.listSubscriptions()).toHaveLength(0);
    });

    it('writes alert bookkeeping through the store', async () => {
      const store = new RecordingStore();
      const agent = new MockAgent();
      const watcher = new Watcher({ agent, store });

      const subscription = watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { callback: jest.fn() },
        cooldown: 0,
      });

      agent.emit('claim:threshold', buildEvent());
      await flushPromises();
      await watcher.flush();

      const stored = await store.getSubscription(subscription.subscriberId);
      expect(stored?.alertCount).toBe(1);
      expect(stored?.lastAlertAt).toBeDefined();
    });

    it('removes once-mode subscriptions from the store after firing', async () => {
      const store = new RecordingStore();
      const agent = new MockAgent();
      const watcher = new Watcher({ agent, store });

      watcher.subscribe('clm_sol_001', {
        on: 'CRITICAL',
        notify: { callback: jest.fn() },
        mode: 'once',
        cooldown: 0,
      });

      agent.emit('claim:threshold', buildEvent());
      await flushPromises();
      await watcher.flush();

      expect(await store.listSubscriptions()).toHaveLength(0);
    });
  });
});
