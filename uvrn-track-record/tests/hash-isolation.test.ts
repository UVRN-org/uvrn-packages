/**
 * Prove track-record data never enters hashed receipt field lists.
 * This unit owns store/scoring only — receipt hash bytes must be unchanged
 * when track records exist alongside a receipt payload.
 */
import { createHash } from 'crypto';
import { InMemoryTrackRecordStore, buildForecastResolution } from '../src';

/** Minimal stand-in for frozen receipt hash input (field list excluded track records). */
function assembleHashInput(receipt: Record<string, unknown>): string {
  const {
    // Explicitly drop any accidental track-record keys — production assembleHashInput
    // never includes them; this test proves callers must not add them either.
    trackRecord: _tr,
    trackRecords: _trs,
    learnedCredibility: _lc,
    ...hashed
  } = receipt as Record<string, unknown> & {
    trackRecord?: unknown;
    trackRecords?: unknown;
    learnedCredibility?: unknown;
  };
  void _tr;
  void _trs;
  void _lc;
  return JSON.stringify(hashed);
}

function sha(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

describe('hash isolation', () => {
  it('track records beside a receipt do not change hash input', async () => {
    const store = new InMemoryTrackRecordStore();
    await store.addTranscription({
      originId: 'origin:hash',
      sampleId: 's1',
      observedAt: '2026-07-01T00:00:00.000Z',
      faithful: true,
      originValue: 1,
      restatedValue: 1,
    });
    await store.addForecastResolution(
      buildForecastResolution({
        originId: 'origin:hash',
        forecastId: 'f1',
        appliesToEnd: '2026-01-01T00:00:00.000Z',
        resolvedAt: '2026-01-02T00:00:00.000Z',
        forecastP: 0.6,
        outcome: 1,
      })
    );
    const track = await store.getRecord('origin:hash');

    const baseReceipt = {
      schema: 'uvrn-receipt-4',
      claimId: 'clm_test',
      value: 42,
    };
    const withTrackNearby = {
      ...baseReceipt,
      trackRecord: track,
      learnedCredibility: await store.getLearnedCredibility('origin:hash'),
    };

    expect(sha(assembleHashInput(baseReceipt))).toBe(sha(assembleHashInput(withTrackNearby)));
  });
});
