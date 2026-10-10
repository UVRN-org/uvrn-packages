/**
 * The README quickstart, executed: claim → engine → measurements → master receipt →
 * signed NetworkReceipt → full verification, all through the single @uvrn/protocol install.
 */

import {
  runDeltaEngine,
  buildMasterReceipt,
  verifyMasterReceipt,
  agreeMeasurement,
  enrichMeasurements,
  wrapMasterReceipt,
  signReceipt,
  verifyReceiptFull,
  generateReceiptKeyPair,
  toHumanView,
  core,
  receipt as receiptNs,
  normalize as normalizeNs,
  algox,
} from '../src';

describe('@uvrn/protocol quickstart', () => {
  it('runs the 10-line claim → signed MasterReceipt flow', () => {
    const claim = 'BTC traded above 100k on 2026-06-09';
    const base = runDeltaEngine({
      bundleId: 'quickstart-1',
      claim,
      thresholdPct: 0.05,
      dataSpecs: [
        { id: 'a', label: 'Source A', sourceKind: 'metric', originDocIds: ['doc-a'], metrics: [{ key: 'price', value: 100_400 }] },
        { id: 'b', label: 'Source B', sourceKind: 'metric', originDocIds: ['doc-b'], metrics: [{ key: 'price', value: 100_900 }] },
      ],
    });
    const measurements = enrichMeasurements([
      agreeMeasurement.evaluate({
        claim,
        sources: [
          { id: 'a', kind: 'numeric', value: 100_400 },
          { id: 'b', kind: 'numeric', value: 100_900 },
        ],
      }),
    ]);
    const master = buildMasterReceipt({
      base,
      claim,
      measurements,
      nodes: [
        { id: 'a', status: 'on' },
        { id: 'b', status: 'on' },
      ],
    });
    const keys = generateReceiptKeyPair();
    const signed = signReceipt(
      wrapMasterReceipt(master, { claim, source: 'quickstart', action: 'master.measured', topic: 'markets/crypto/BTC' }),
      { privateKey: keys.privateKey, publicKeyRef: 'quickstart-pk-1' }
    );

    expect(verifyMasterReceipt(master).verified).toBe(true);
    expect(measurements[0].humanExplanation).toContain('Sources align');
    expect(
      verifyReceiptFull(signed, { keys: { 'quickstart-pk-1': keys.publicKey } }).verified
    ).toBe(true);
    expect(toHumanView(signed).verdictTone).toBe('aligned');
  });

  it('exposes the namespaced packages', () => {
    expect(core.VSCORE_WEIGHTS.completeness).toBe(0.35);
    expect(typeof receiptNs.canonicalize).toBe('function');
  });

  it('normalizes and ranks research inputs through the umbrella', async () => {
    const normalized = normalizeNs.normalize(
      [
        {
          url: 'https://example.com/primary',
          title: 'Primary report',
          snippet: 'Independent evidence scored 82.',
          publishedAt: '2026-07-19T12:00:00.000Z',
          evidenceScore: 82,
        },
        {
          url: 'https://example.net/secondary',
          title: 'Secondary report',
          snippet: 'Independent evidence scored 74.',
          publishedAt: '2026-07-19T12:05:00.000Z',
          evidenceScore: 74,
        },
      ],
      'general'
    );
    const ranked = await algox.rankSignals(
      normalized.sources.map((source) => ({
        label: source.name,
        source: new URL((source.rawData as { url: string }).url).hostname,
        prominence: typeof source.value === 'number' ? source.value : 0,
      })),
      { topK: 2, maxAgeDays: null }
    );

    expect(normalized.sources.map((source) => source.value)).toEqual([82, 74]);
    expect(ranked.ranked.map((candidate) => candidate.prominence)).toEqual([82, 74]);
  });
});
