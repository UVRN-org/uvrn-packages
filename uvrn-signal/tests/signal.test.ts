import { SignalBridge, SignalBus } from '../src';
import type { DriftThresholdEvent, UVRNEventMap } from '../src';

interface ExtendedEventMap extends UVRNEventMap {
  'custom:ping': { id: string; ok: boolean };
}

describe('@uvrn/signal', () => {
  test('bus.on() and emit() deliver typed payloads', () => {
    const bus = new SignalBus();
    const received: DriftThresholdEvent[] = [];

    bus.on('drift:threshold', (event) => {
      received.push(event);
    });

    const payload: DriftThresholdEvent = {
      claimId: 'clm_001',
      status: 'DRIFTING',
      snapshot: {
        adjustedScore: 67,
        freshness: 54,
        decayRate: 0.3,
        timestamp: 1711929600000,
      },
    };

    bus.emit('drift:threshold', payload);

    expect(received).toEqual([payload]);
  });

  test('bus.once() fires only once', () => {
    const bus = new SignalBus();
    const handler = jest.fn();

    bus.once('canon:suggested', handler);
    bus.emit('canon:suggested', {
      receiptId: 'rcpt_1',
      claimId: 'clm_001',
      reason: 'stable',
      score: 90,
    });
    bus.emit('canon:suggested', {
      receiptId: 'rcpt_2',
      claimId: 'clm_001',
      reason: 'stable',
      score: 91,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('bus.off() removes the listener', () => {
    const bus = new SignalBus();
    const handler = jest.fn();

    bus.on('agent:stopped', handler);
    bus.off('agent:stopped', handler);
    bus.emit('agent:stopped', { claimId: 'clm_001' });

    expect(handler).not.toHaveBeenCalled();
  });

  test('removeAllListeners() clears a specific event and all events', () => {
    const bus = new SignalBus();
    const thresholdHandler = jest.fn();
    const stableHandler = jest.fn();

    bus.on('drift:threshold', thresholdHandler);
    bus.on('drift:stable', stableHandler);

    bus.removeAllListeners('drift:threshold');
    bus.emit('drift:threshold', {
      claimId: 'clm_001',
      status: 'CRITICAL',
      snapshot: {
        adjustedScore: 33,
        freshness: 11,
        decayRate: 0.9,
        timestamp: 1711929600000,
      },
    });
    bus.emit('drift:stable', {
      claimId: 'clm_001',
      snapshot: {
        adjustedScore: 81,
        freshness: 74,
        timestamp: 1711929600000,
      },
    });

    expect(thresholdHandler).not.toHaveBeenCalled();
    expect(stableHandler).toHaveBeenCalledTimes(1);

    bus.removeAllListeners();
    bus.emit('drift:stable', {
      claimId: 'clm_001',
      snapshot: {
        adjustedScore: 83,
        freshness: 78,
        timestamp: 1711929601000,
      },
    });

    expect(stableHandler).toHaveBeenCalledTimes(1);
  });

  test('SignalBridge forwards and disconnects events', () => {
    const source = new SignalBus();
    const target = new SignalBus();
    const bridge = new SignalBridge(source, target);
    const handler = jest.fn();

    target.on('watch:alert', handler);
    bridge.connect('watch:alert').connect('watch:alert');

    source.emit('watch:alert', {
      claimId: 'clm_001',
      status: 'CRITICAL',
      subscriberId: 'sub_1',
    });

    bridge.disconnect('watch:alert');
    source.emit('watch:alert', {
      claimId: 'clm_001',
      status: 'DRIFTING',
      subscriberId: 'sub_1',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      claimId: 'clm_001',
      status: 'CRITICAL',
      subscriberId: 'sub_1',
    });
  });

  test('custom event maps preserve inference', () => {
    const bus = new SignalBus<ExtendedEventMap>();
    const results: Array<{ id: string; ok: boolean }> = [];

    bus.on('custom:ping', (event) => {
      results.push({ id: event.id, ok: event.ok });
    });

    bus.emit('custom:ping', { id: 'ping-1', ok: true });

    expect(results).toEqual([{ id: 'ping-1', ok: true }]);
  });
});
