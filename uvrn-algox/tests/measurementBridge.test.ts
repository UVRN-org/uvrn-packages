import {
  measurementResultsToCandidates,
  rankMeasurementResults,
  type MeasurementResultLike,
} from '../src/presets/measurementBridge';

const FIXTURE: MeasurementResultLike[] = [
  {
    type: 'agree',
    verdict: 'agree',
    confidence: 0.9,
    explanation: 'Agreement score 0.91 at threshold 0.7',
    evidenceRefs: ['src-a', 'src-b'],
    observedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    type: 'disagree',
    verdict: 'disagree',
    confidence: 0.6,
    explanation: 'Sources diverge by 0.4, above threshold 0.25',
    evidenceRefs: ['src-a', 'src-c'],
    observedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    type: 'conflict',
    verdict: 'conflict',
    confidence: 0.4,
    explanation: 'Conflicting evidence classes present',
    evidenceRefs: ['src-b'],
  },
  {
    type: 'agree',
    verdict: 'insufficient-data',
    confidence: 0.1,
    explanation: 'Not enough sources to evaluate agreement',
  },
];

describe('measurementResultsToCandidates', () => {
  it('maps measurement rows into Candidate[] with prominence from confidence', () => {
    const candidates = measurementResultsToCandidates(FIXTURE);
    expect(candidates).toHaveLength(4);
    expect(candidates[0]).toMatchObject({
      label: 'agree:agree',
      source: 'agree',
      prominence: 90,
      measurementType: 'agree',
      measurementVerdict: 'agree',
    });
    expect(candidates[0]!.signals).toEqual({
      confidence: 0.9,
      measurementConfidence: 0.9,
    });
    expect(candidates[0]!.evidenceRefs).toEqual(['src-a', 'src-b']);
  });

  it('preserves insufficient-data by default (does not hide the gap)', () => {
    const candidates = measurementResultsToCandidates(FIXTURE);
    const insufficient = candidates.find((c) => c.measurementVerdict === 'insufficient-data');
    expect(insufficient).toBeDefined();
    expect(insufficient!.prominence).toBe(10);
  });

  it('can omit insufficient-data when asked', () => {
    const candidates = measurementResultsToCandidates(FIXTURE, {
      includeInsufficient: false,
    });
    expect(candidates.every((c) => c.measurementVerdict !== 'insufficient-data')).toBe(true);
    expect(candidates).toHaveLength(3);
  });

  it('clamps non-finite / out-of-range confidence honestly', () => {
    const [candidate] = measurementResultsToCandidates([
      { type: 'agree', verdict: 'agree', confidence: 1.5 },
    ]);
    expect(candidate!.prominence).toBe(100);
    expect(candidate!.signals?.confidence).toBe(1);
  });
});

describe('rankMeasurementResults', () => {
  it('ranks via existing rankSignals (highest confidence first)', async () => {
    const result = await rankMeasurementResults(FIXTURE, {
      topK: 10,
      now: '2026-08-07T00:00:00.000Z',
    });

    expect(result.ranked.length).toBeGreaterThan(0);
    expect(result.ranked[0]!.label).toBe('agree:agree');
    expect(result.ranked[0]!.score).toBeGreaterThan(result.ranked[1]!.score);
    // Ordering only — not verification / market outcome
    expect(result.config.maxAgeDays).toBeNull();
  });

  it('honors caller maxAgeDays when provided', async () => {
    const result = await rankMeasurementResults(
      [
        {
          type: 'agree',
          verdict: 'agree',
          confidence: 0.9,
          observedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      { maxAgeDays: 30, now: '2026-08-07T00:00:00.000Z', topK: 5 }
    );
    expect(result.dropped.some((d) => d.reason)).toBe(true);
  });
});
