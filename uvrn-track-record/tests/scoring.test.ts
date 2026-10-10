import {
  brierScore,
  buildForecastResolution,
  canResolveForecast,
  deriveLearnedCredibility,
  emptyTrackRecord,
  isFaithfulTranscription,
  formatTrackRecordObservation,
} from '../src';

describe('proper scoring (Brier)', () => {
  it('scores certain correct forecast as 0', () => {
    expect(brierScore(1, 1)).toBe(0);
    expect(brierScore(0, 0)).toBe(0);
  });

  it('scores certain wrong forecast as 1', () => {
    expect(brierScore(1, 0)).toBe(1);
    expect(brierScore(0, 1)).toBe(1);
  });

  it('is worse for overconfident miscalibration than for 0.5', () => {
    expect(brierScore(0.9, 0)).toBeGreaterThan(brierScore(0.5, 0));
  });

  it('rejects out-of-range forecastP', () => {
    expect(() => brierScore(1.2, 1)).toThrow(/forecastP/);
  });
});

describe('transcription fidelity', () => {
  it('is arithmetic equality', () => {
    expect(isFaithfulTranscription(42, 42)).toBe(true);
    expect(isFaithfulTranscription(42, 43)).toBe(false);
  });
});

describe('forecast resolve gate', () => {
  it('blocks resolve before appliesToEnd', () => {
    expect(
      canResolveForecast('2026-12-31T00:00:00.000Z', '2026-06-01T00:00:00.000Z')
    ).toBe(false);
  });

  it('allows resolve at or after appliesToEnd', () => {
    expect(
      canResolveForecast('2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')
    ).toBe(true);
  });

  it('buildForecastResolution throws when unresolved', () => {
    expect(() =>
      buildForecastResolution({
        originId: 'o1',
        forecastId: 'f1',
        appliesToEnd: '2026-12-31T00:00:00.000Z',
        resolvedAt: '2026-01-01T00:00:00.000Z',
        forecastP: 0.7,
        outcome: 1,
      })
    ).toThrow(/unresolved/);
  });
});

describe('learned credibility derivation', () => {
  it('returns null with no observations', () => {
    expect(deriveLearnedCredibility(emptyTrackRecord('o'))).toBeNull();
  });

  it('uses fidelity when only transcription present', () => {
    const r = emptyTrackRecord('o');
    r.transcription = { samples: 4, faithful: 3, fidelity: 0.75 };
    expect(deriveLearnedCredibility(r)).toBeCloseTo(0.75);
  });

  it('observation formatter avoids verdict language', () => {
    const r = emptyTrackRecord('origin:x');
    r.transcription = { samples: 1, faithful: 1, fidelity: 1 };
    const text = formatTrackRecordObservation(r);
    expect(text.toLowerCase()).not.toMatch(/dishonest|liar|fraud|untrustworthy/);
    expect(text).toMatch(/observation/i);
  });
});
