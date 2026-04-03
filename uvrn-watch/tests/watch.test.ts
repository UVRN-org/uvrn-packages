import EventEmitter from 'events';
import { Watcher, type AlertEvent, type DeliveryTarget } from '../src';
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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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

    const watcher = new Watcher({ agent });
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
});
