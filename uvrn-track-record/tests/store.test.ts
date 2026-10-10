import {
  InMemoryTrackRecordStore,
  buildForecastResolution,
  isFaithfulTranscription,
} from '../src';

describe('InMemoryTrackRecordStore', () => {
  it('accumulates transcription fidelity and is idempotent on sampleId', async () => {
    const store = new InMemoryTrackRecordStore();
    const sample = {
      originId: 'origin:a',
      sampleId: 's1',
      observedAt: '2026-07-01T00:00:00.000Z',
      faithful: isFaithfulTranscription(10, 10),
      originValue: 10,
      restatedValue: 10,
    };
    await store.addTranscription(sample);
    await store.addTranscription(sample);
    await store.addTranscription({
      ...sample,
      sampleId: 's2',
      faithful: false,
      restatedValue: 11,
    });
    const rec = await store.getRecord('origin:a');
    expect(rec?.transcription.samples).toBe(2);
    expect(rec?.transcription.faithful).toBe(1);
    expect(rec?.transcription.fidelity).toBeCloseTo(0.5);
  });

  it('records revisions without editorializing', async () => {
    const store = new InMemoryTrackRecordStore();
    await store.addRevision({
      originId: 'origin:a',
      revisionId: 'r1',
      observedAt: '2026-07-02T00:00:00.000Z',
      priorId: 'claim:old',
    });
    const rec = await store.getRecord('origin:a');
    expect(rec?.revisions.count).toBe(1);
    expect(rec?.revisions.lastRevisionAt).toBe('2026-07-02T00:00:00.000Z');
  });

  it('rejects early forecast resolution and scores after period', async () => {
    const store = new InMemoryTrackRecordStore();
    await expect(
      store.addForecastResolution({
        originId: 'origin:a',
        forecastId: 'f1',
        appliesToEnd: '2026-12-31T00:00:00.000Z',
        resolvedAt: '2026-01-01T00:00:00.000Z',
        forecastP: 0.8,
        outcome: 1,
        brier: 0.04,
        scoringRule: 'brier',
      })
    ).rejects.toThrow(/unresolved/);

    const resolution = buildForecastResolution({
      originId: 'origin:a',
      forecastId: 'f1',
      appliesToEnd: '2026-06-01T00:00:00.000Z',
      resolvedAt: '2026-06-02T00:00:00.000Z',
      forecastP: 0.8,
      outcome: 1,
    });
    await store.addForecastResolution(resolution);
    const rec = await store.getRecord('origin:a');
    expect(rec?.forecasts.resolved).toBe(1);
    expect(rec?.forecasts.meanBrier).toBeCloseTo(0.04);
    const learned = await store.getLearnedCredibility('origin:a');
    expect(learned).toBeCloseTo(1 - 0.04);
  });

  it('put/list round-trip', async () => {
    const store = new InMemoryTrackRecordStore();
    await store.putRecord({
      originId: 'origin:z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      transcription: { samples: 0, faithful: 0, fidelity: null },
      revisions: { count: 0 },
      forecasts: { resolved: 0, meanBrier: null },
      notes: 'operator note — observation only',
    });
    const listed = await store.listRecords(10);
    expect(listed.map((r) => r.originId)).toEqual(['origin:z']);
  });
});
