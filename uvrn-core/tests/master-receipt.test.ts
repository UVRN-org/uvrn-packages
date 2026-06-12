import {
  buildMasterReceipt,
  DeltaBundle,
  MasterReceipt,
  runDeltaEngine,
  verifyMasterReceipt,
  verifyReceipt,
} from '../src';

const bundle: DeltaBundle = {
  bundleId: 'master-001',
  claim: 'Master receipt fixture',
  thresholdPct: 0.05,
  dataSpecs: [
    {
      id: 'src-a',
      label: 'Source A',
      sourceKind: 'metric',
      originDocIds: ['doc-a'],
      metrics: [{ key: 'value', value: 100 }],
    },
    {
      id: 'src-b',
      label: 'Source B',
      sourceKind: 'metric',
      originDocIds: ['doc-b'],
      metrics: [{ key: 'value', value: 102 }],
    },
  ],
};

function buildFixture(): MasterReceipt {
  const base = runDeltaEngine(bundle);
  return buildMasterReceipt({
    base,
    claim: 'Master receipt fixture',
    timestamp: '2026-06-05T21:25:00.000Z',
    measurements: [
      {
        type: 'agree',
        verdict: 'agree',
        confidence: 0.98,
        explanation: 'Sources converge within tolerance.',
        evidenceRefs: ['src-a', 'src-b'],
      },
    ],
    nodes: [
      { id: 'src-a', status: 'on', observedAt: '2026-06-05T21:25:00.000Z' },
      { id: 'src-b', status: 'unavailable', detail: 'timeout', observedAt: '2026-06-05T21:25:00.000Z' },
      { id: 'src-c', status: 'off', detail: 'disabled' },
    ],
  });
}

describe('Master receipt', () => {
  it('round-trips through verifyMasterReceipt and preserves base verification', () => {
    const masterReceipt = buildFixture();

    expect(verifyReceipt(masterReceipt.base).verified).toBe(true);
    expect(verifyMasterReceipt(masterReceipt)).toEqual({
      verified: true,
      baseVerified: true,
      masterHashOk: true,
    });
  });

  it('detects measurement tampering through the master hash', () => {
    const masterReceipt = buildFixture();
    const tampered: MasterReceipt = {
      ...masterReceipt,
      measurements: [
        {
          ...masterReceipt.measurements[0],
          confidence: 0.1,
        },
      ],
    };

    expect(verifyMasterReceipt(tampered)).toEqual({
      verified: false,
      baseVerified: true,
      masterHashOk: false,
      error: 'Master receipt hash mismatch',
    });
  });

  it('detects node tampering through the master hash', () => {
    const masterReceipt = buildFixture();
    const tampered: MasterReceipt = {
      ...masterReceipt,
      nodes: masterReceipt.nodes.map((node) => (node.id === 'src-b' ? { ...node, status: 'on' } : node)),
    };

    expect(verifyMasterReceipt(tampered).masterHashOk).toBe(false);
  });

  it('preserves off and unavailable node records verbatim', () => {
    const masterReceipt = buildFixture();

    expect(masterReceipt.nodes).toContainEqual({
      id: 'src-b',
      status: 'unavailable',
      detail: 'timeout',
      observedAt: '2026-06-05T21:25:00.000Z',
    });
    expect(masterReceipt.nodes).toContainEqual({
      id: 'src-c',
      status: 'off',
      detail: 'disabled',
    });
  });

  it('keeps the golden base hash regression intact', () => {
    const goldenBundle: DeltaBundle = {
      bundleId: 'golden-001',
      claim: 'Test Bundle',
      thresholdPct: 0.05,
      maxRounds: 5,
      dataSpecs: [
        {
          id: 'src-A',
          label: 'Source A',
          sourceKind: 'metric',
          originDocIds: ['doc-1'],
          metrics: [
            { key: 'revenue', value: 100 },
            { key: 'users', value: 50 },
          ],
        },
        {
          id: 'src-B',
          label: 'Source B',
          sourceKind: 'metric',
          originDocIds: ['doc-2'],
          metrics: [
            { key: 'revenue', value: 102 },
            { key: 'users', value: 50 },
          ],
        },
      ],
    };

    expect(runDeltaEngine(goldenBundle).hash).toBe('af0735636388f76e19be836337f3449ba38412e677cea1b0f0f51e63f3e3b477');
  });
});

describe('Master receipt ordering rule (SPEC uvrn-receipt-v1 §2.2)', () => {
  it('sorts measurements by (type, first evidence ref) and nodes by id before hashing', () => {
    const base = runDeltaEngine(bundle);
    const args = {
      base,
      claim: 'ordering fixture',
      timestamp: '2026-06-10T12:00:00.000Z',
      measurements: [
        { type: 'disagree', verdict: 'none', confidence: 1, explanation: 'x', evidenceRefs: ['src-b'] },
        { type: 'agree', verdict: 'agree', confidence: 0.9, explanation: 'y', evidenceRefs: ['src-b'] },
        { type: 'agree', verdict: 'agree', confidence: 0.9, explanation: 'z', evidenceRefs: ['src-a'] },
      ],
      nodes: [
        { id: 'src-c', status: 'off' as const },
        { id: 'src-a', status: 'on' as const },
      ],
    };
    const receipt = buildMasterReceipt(args);
    expect(receipt.measurements.map((m) => `${m.type}:${m.evidenceRefs[0]}`)).toEqual([
      'agree:src-a',
      'agree:src-b',
      'disagree:src-b',
    ]);
    expect(receipt.nodes.map((n) => n.id)).toEqual(['src-a', 'src-c']);

    // Producer ordering is canonical: shuffled input yields the identical masterHash.
    const shuffled = buildMasterReceipt({
      ...args,
      measurements: [args.measurements[2], args.measurements[0], args.measurements[1]],
      nodes: [args.nodes[1], args.nodes[0]],
    });
    expect(shuffled.masterHash).toBe(receipt.masterHash);

    // Verification recomputes over stored order — pre-rule receipts stay valid.
    expect(verifyMasterReceipt(receipt).verified).toBe(true);
  });
});
