import {
  FrequencySpikeDetector,
  InMemoryHistoryReader,
  historyEventsFromStoredReceipts,
  historyEventsFromTrackRecords,
  scanPatterns,
} from '../src';
import type { HistoryReader, ScanScope } from '../src';

const window = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-31T23:59:59.000Z',
};

const scope: ScanScope = {
  joinScope: 'test-join-scope',
  window,
};

describe('scanPatterns', () => {
  it('refuses scans without joinScope', async () => {
    const reader = new InMemoryHistoryReader([
      { id: '1', subjectRef: 'a', observedAt: '2026-08-05T00:00:00.000Z' },
    ]);
    const result = await scanPatterns(reader, {
      joinScope: '   ',
      window,
    } as ScanScope);
    expect(result.status).toBe('refused');
    expect(result.honesty.receiptClass).toBe(false);
    expect(result.honesty.detectedNotVerified).toBe(true);
  });

  it('empty history → honest insufficient (not verified)', async () => {
    const reader = new InMemoryHistoryReader([]);
    const result = await scanPatterns(reader, scope);
    expect(result.status).toBe('insufficient');
    expect(result.observations).toEqual([]);
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/"verified"\s*:\s*true/);
  });

  it('emits PatternObservation with required honesty fields; never verified', async () => {
    const reader = new InMemoryHistoryReader([
      { id: '1', subjectRef: 'claim:x', observedAt: '2026-08-02T00:00:00.000Z' },
      { id: '2', subjectRef: 'claim:x', observedAt: '2026-08-03T00:00:00.000Z' },
      { id: '3', subjectRef: 'claim:x', observedAt: '2026-08-04T00:00:00.000Z' },
    ]);
    const result = await scanPatterns(reader, scope, new FrequencySpikeDetector({ minCount: 3 }));
    expect(result.status).toBe('observations');
    if (result.status !== 'observations') return;
    expect(result.observations).toHaveLength(1);
    const obs = result.observations[0];
    expect(obs.joinScope).toBe('test-join-scope');
    expect(obs.falsePositiveStance).toBe('disclosed-inherent');
    expect(obs.confidenceNote.toLowerCase()).toMatch(/uncalibrated/);
    expect(obs.summary.toLowerCase()).toMatch(/not verified/);
    expect(JSON.stringify(obs).toLowerCase()).not.toContain('"verified"');
    expect(result.honesty.receiptClass).toBe(false);
  });

  it('measured-gap when HistoryReader reports store-API failure', async () => {
    const reader: HistoryReader = {
      async readBatch() {
        return {
          ok: false,
          reason: 'measured-gap',
          message: 'store cannot answer scoped batch without cross-claim index',
        };
      },
    };
    const result = await scanPatterns(reader, scope);
    expect(result.status).toBe('measured-gap');
    if (result.status !== 'measured-gap') return;
    expect(result.escalate).toBe(true);
    expect(result.message).toMatch(/cross-claim index/);
  });

  it('measured-gap when HistoryReader throws', async () => {
    const reader: HistoryReader = {
      async readBatch() {
        throw new Error('sqlite list() unavailable');
      },
    };
    const result = await scanPatterns(reader, scope);
    expect(result.status).toBe('measured-gap');
    if (result.status !== 'measured-gap') return;
    expect(result.escalate).toBe(true);
  });

  it('maps track-record and receipt list shapes without new index', async () => {
    const fromTrack = historyEventsFromTrackRecords([
      { originId: 'origin:a', updatedAt: '2026-08-10T00:00:00.000Z' },
    ]);
    expect(fromTrack[0].subjectRef).toBe('origin:a');
    const fromReceipts = historyEventsFromStoredReceipts([
      {
        createdAt: '2026-08-11T00:00:00.000Z',
        receipt: { claimId: 'claim:1', receiptHash: 'abc' },
      },
    ]);
    expect(fromReceipts[0].subjectRef).toBe('claim:1');
  });
});
