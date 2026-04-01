// ─────────────────────────────────────────────
// @uvrn/drift · tests
// ─────────────────────────────────────────────

import {
  computeDrift,
  scoreToStatus,
  DriftMonitor,
  profileFor,
  DRIFT_PROFILES,
  linearDecay,
  sigmoidDecay,
  exponentialDecay,
} from '../src/index';
import type { DriftInputReceipt, DriftThresholdEvent } from '../src/types/index';

function makeReceipt(overrides: Partial<DriftInputReceipt> = {}): DriftInputReceipt {
  return {
    receipt_id:  'test_r1',
    issuer:      'test.uvrn.org',
    timestamp:   new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    v_score:     88,
    components:  { completeness: 92, parity: 85, freshness: 88 },
    tags:        ['#uvrn', '#drvc3'],
    ...overrides,
  };
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

describe('Decay curves', () => {
  const score = 100;

  it('LINEAR: −0.5pts/hr × 10h = 95', () => {
    expect(linearDecay(score, 10, 0.5)).toBe(95);
  });

  it('LINEAR floors at 0', () => {
    expect(linearDecay(100, 300, 0.5)).toBe(0);
  });

  it('SIGMOID at midpoint should be ~50% of original', () => {
    const sig = sigmoidDecay(100, 48, 48);
    expect(sig).toBeGreaterThan(45);
    expect(sig).toBeLessThan(55);
  });

  it('SIGMOID before midpoint should be > 75', () => {
    const sigEarly = sigmoidDecay(100, 10, 48);
    expect(sigEarly).toBeGreaterThan(75);
  });

  it('EXPONENTIAL: 100 × e^(−0.03 × 24) ≈ 48.7', () => {
    const exp = exponentialDecay(100, 24, 0.03);
    expect(exp).toBeGreaterThan(45);
    expect(exp).toBeLessThan(52);
  });
});

describe('computeDrift()', () => {
  it('computes drift for 24h-old receipt with moderate profile', () => {
    const receipt = makeReceipt({ timestamp: hoursAgo(24) });
    const result  = computeDrift(receipt, DRIFT_PROFILES.moderate);
    expect(result.drift.age_hours).toBeGreaterThan(23);
    expect(result.drift.age_hours).toBeLessThan(25);
    expect(result.drift.delta).toBeLessThan(0);
    expect(result.drift.decayed_score).toBeLessThan(receipt.v_score);
    expect(result.drift.curve).toBe('EXPONENTIAL');
  });

  it('fresh receipt has minimal delta with slow profile', () => {
    const freshReceipt = makeReceipt({ timestamp: hoursAgo(0.1) });
    const freshResult  = computeDrift(freshReceipt, DRIFT_PROFILES.slow);
    expect(Math.abs(freshResult.drift.delta)).toBeLessThan(1);
  });
});

describe('scoreToStatus()', () => {
  it('returns STABLE for 95 and 80', () => {
    expect(scoreToStatus(95)).toBe('STABLE');
    expect(scoreToStatus(80)).toBe('STABLE');
  });
  it('returns DRIFTING for 79 and 60', () => {
    expect(scoreToStatus(79)).toBe('DRIFTING');
    expect(scoreToStatus(60)).toBe('DRIFTING');
  });
  it('returns CRITICAL for 59 and 0', () => {
    expect(scoreToStatus(59)).toBe('CRITICAL');
    expect(scoreToStatus(0)).toBe('CRITICAL');
  });
});

describe('profileFor()', () => {
  it('resolves known profile by name', () => {
    expect(profileFor('moderate').name).toBe('moderate');
  });
  it('falls back to default for unknown name', () => {
    expect(profileFor('unknown').name).toBe('default');
  });
});

describe('DriftMonitor', () => {
  it('snapshot returns degraded status for 72h-old fast-decay receipt', () => {
    const events: DriftThresholdEvent[] = [];
    const monitor = new DriftMonitor({
      intervalMs: 100,
      onThreshold: (e) => events.push(e),
      onTick:      () => {},
    });
    const oldReceipt: DriftInputReceipt = {
      receipt_id:  'old_r1',
      issuer:      'test.uvrn.org',
      timestamp:   hoursAgo(72),
      v_score:     88,
      components:  { completeness: 92, parity: 85, freshness: 88 },
    };
    monitor.watch(oldReceipt, DRIFT_PROFILES.fast);
    const snap = monitor.snapshot();
    expect(snap.length).toBe(1);
    expect(['DRIFTING', 'CRITICAL']).toContain(snap[0].drift.status);
    expect(snap[0].drift.decayed_score).toBeLessThan(oldReceipt.v_score);
  });
});

describe('Profile smoke tests', () => {
  it('all built-in profiles compute drift for 48h-old receipt', () => {
    const r48 = makeReceipt({ timestamp: hoursAgo(48) });
    Object.values(DRIFT_PROFILES).forEach(profile => {
      const res = computeDrift(r48, profile);
      expect(res.drift.decayed_score).toBeDefined();
      expect(['STABLE', 'DRIFTING', 'CRITICAL']).toContain(res.drift.status);
    });
  });
});
