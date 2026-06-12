/**
 * BaseConnector guard tests: rate limiting + circuit breaker.
 * Uses the injectable `now` clock from ConnectorConfig — no sleeping.
 */
import type { ClaimRegistration, FarmResult } from '@uvrn/agent';
import { mockFarmResult } from '@uvrn/test';

import {
  BaseConnector,
  CircuitOpenError,
  type ConnectorConfig,
  FarmConnectorError,
  RateLimitError,
} from '../src';

/** Mutable fake clock for driving the sliding window and breaker timers. */
class FakeClock {
  private ms = 0;

  now = (): number => this.ms;

  advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

/** Test connector exposing the protected withGuards() helper. */
class GuardProbeConnector extends BaseConnector {
  readonly name = 'GuardProbeConnector';

  constructor(config: ConnectorConfig = {}) {
    super(config);
  }

  async fetch(_claim: ClaimRegistration): Promise<FarmResult> {
    return mockFarmResult();
  }

  async guarded<T>(fn: () => Promise<T>): Promise<T> {
    return this.withGuards(fn);
  }
}

const ok = async (): Promise<string> => 'ok';
const boom = async (): Promise<string> => {
  throw new FarmConnectorError('GuardProbeConnector', 'simulated failure');
};

describe('BaseConnector rate limiting', () => {
  it('rejects the (limit+1)th call within a minute with RateLimitError', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({ rateLimitPerMinute: 3, now: clock.now });

    await expect(connector.guarded(ok)).resolves.toBe('ok');
    clock.advance(1_000);
    await expect(connector.guarded(ok)).resolves.toBe('ok');
    clock.advance(1_000);
    await expect(connector.guarded(ok)).resolves.toBe('ok');
    clock.advance(1_000);

    await expect(connector.guarded(ok)).rejects.toThrow(RateLimitError);
  });

  it('allows requests again after the window slides past the oldest request', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({ rateLimitPerMinute: 2, now: clock.now });

    await connector.guarded(ok); // t=0
    clock.advance(10_000);
    await connector.guarded(ok); // t=10s
    await expect(connector.guarded(ok)).rejects.toThrow(RateLimitError);

    // Slide just past the t=0 request: one slot frees up.
    clock.advance(50_001); // t=60.001s
    await expect(connector.guarded(ok)).resolves.toBe('ok');

    // Window still holds t=10s and t=60.001s — full again.
    await expect(connector.guarded(ok)).rejects.toThrow(RateLimitError);
  });

  it('reports the configured limit and a positive retryAfterMs', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({ rateLimitPerMinute: 1, now: clock.now });

    await connector.guarded(ok);
    clock.advance(15_000);

    try {
      await connector.guarded(ok);
      throw new Error('expected RateLimitError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      const rateLimitError = error as RateLimitError;
      expect(rateLimitError.limit).toBe(1);
      expect(rateLimitError.retryAfterMs).toBe(45_000);
      expect(rateLimitError.connectorName).toBe('GuardProbeConnector');
    }
  });

  it('does not rate limit when rateLimitPerMinute is unset (zero-config)', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({ now: clock.now });

    for (let i = 0; i < 50; i += 1) {
      await expect(connector.guarded(ok)).resolves.toBe('ok');
    }
  });
});

describe('BaseConnector circuit breaker', () => {
  it('opens after circuitBreakerThreshold consecutive failures and rejects fast', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({ circuitBreakerThreshold: 3, now: clock.now });

    for (let i = 0; i < 3; i += 1) {
      await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    }

    // Circuit is now open: rejects without invoking the function.
    const spy = jest.fn(ok);
    await expect(connector.guarded(spy)).rejects.toThrow(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('uses the default threshold of 5 when not configured', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({ now: clock.now });

    for (let i = 0; i < 4; i += 1) {
      await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    }

    // Still closed after 4 failures.
    await expect(connector.guarded(ok)).resolves.toBe('ok');

    // Success resets the count; 5 fresh failures open it.
    for (let i = 0; i < 5; i += 1) {
      await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    }
    await expect(connector.guarded(ok)).rejects.toThrow(CircuitOpenError);
  });

  it('half-open probe success closes the circuit', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 30_000,
      now: clock.now,
    });

    await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    await expect(connector.guarded(ok)).rejects.toThrow(CircuitOpenError);

    // After the reset period, one probe is allowed — success closes.
    clock.advance(30_000);
    await expect(connector.guarded(ok)).resolves.toBe('ok');

    // Circuit fully closed: subsequent calls flow normally.
    await expect(connector.guarded(ok)).resolves.toBe('ok');
  });

  it('half-open probe failure reopens the circuit for a full reset period', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 30_000,
      now: clock.now,
    });

    await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');

    clock.advance(30_000);
    await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');

    // Reopened: rejects fast again, even just before the new reset elapses.
    clock.advance(29_999);
    const spy = jest.fn(ok);
    await expect(connector.guarded(spy)).rejects.toThrow(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();

    // And recovers via a successful probe after the full reset.
    clock.advance(1);
    await expect(connector.guarded(ok)).resolves.toBe('ok');
  });

  it('exposes retryAfterMs on CircuitOpenError', async () => {
    const clock = new FakeClock();
    const connector = new GuardProbeConnector({
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 30_000,
      now: clock.now,
    });

    await expect(connector.guarded(boom)).rejects.toThrow('simulated failure');
    clock.advance(10_000);

    try {
      await connector.guarded(ok);
      throw new Error('expected CircuitOpenError');
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as CircuitOpenError).retryAfterMs).toBe(20_000);
    }
  });

  it('requestJson() failures trip the breaker (guards wrap the built-in helper)', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);

    const clock = new FakeClock();
    const { CoinGeckoFarm } = await import('../src');
    const connector = new CoinGeckoFarm({
      maxRetries: 0,
      circuitBreakerThreshold: 2,
      now: clock.now,
    });

    const claim: ClaimRegistration = {
      id: 'clm_btc_001',
      label: 'Bitcoin',
      query: 'bitcoin',
      driftConfig: { name: 'default', curve: 'LINEAR', rate: 0.15, staleAfterHours: 720, scoreFloor: 0 },
      intervalMs: 60_000,
    };

    await expect(connector.fetch(claim)).rejects.toThrow('Max retries exceeded');
    await expect(connector.fetch(claim)).rejects.toThrow('Max retries exceeded');

    // Breaker open: rejects before hitting fetch again.
    (globalThis.fetch as jest.Mock).mockClear();
    await expect(connector.fetch(claim)).rejects.toThrow(CircuitOpenError);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
