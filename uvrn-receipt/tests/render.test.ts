import { toHumanView, wrapDeltaReceipt, wrapMasterReceipt } from '../src';
import { makeDeltaReceipt, makeMasterReceipt } from './fixtures';

describe('toHumanView', () => {
  const master = makeMasterReceipt();
  const wrapped = wrapMasterReceipt(master, {
    claim: master.claim,
    source: 'uvrn-sdk',
    action: 'master.measured',
    topic: 'markets/crypto/BTC',
  });

  it('renders the full B4 structure from a master receipt', () => {
    const view = toHumanView(wrapped, { scores: { vScore: 85.5, completeness: 0.67, parity: 0.96, freshness: 1 } });

    expect(view.headline).toBe('2 of 3 sources weighed in — sources align');
    expect(view.verdictLabel).toBe('Sources align');
    expect(view.verdictTone).toBe('aligned');
    expect(view.claim).toBe(master.claim);

    expect(view.sources).toHaveLength(3);
    expect(view.sources[2]).toMatchObject({ name: 'source-c', status: 'unavailable' });

    expect(view.measurements).toHaveLength(2);
    expect(view.measurements[0].plainExplanation).toContain('converge');

    expect(view.gaps).toHaveLength(1);
    expect(view.gaps[0].what).toContain('source-c');
    expect(view.gaps[0].plainNote).toContain('not hidden');

    expect(view.scoreCard.vScore).toBe(85.5);
    expect(view.scoreCard.plainMeaning.vScore).toContain('not whether the claim is true');

    expect(view.provenance).toMatchObject({ hash: wrapped.receiptHash, signed: false });
    expect(view.provenance.verifyUrl).toBe(`https://uvrn.org/access/receipt/${wrapped.receiptHash}`);
    expect(view.howToVerify).toContain('integrity-checked only');
  });

  it('tone precedence: contradiction outranks alignment', () => {
    const conflicted = wrapMasterReceipt(
      {
        ...master,
        measurements: [
          ...master.measurements,
          {
            type: 'conflict',
            verdict: 'conflict',
            confidence: 1,
            explanation: 'Conflict: a and b assert mutually exclusive assertions.',
            evidenceRefs: ['source-a', 'source-b'],
          },
        ],
      },
      { claim: master.claim, source: 'uvrn-sdk', action: 'master.measured', narrative: 'conflict fixture' }
    );
    const view = toHumanView(conflicted);
    expect(view.verdictTone).toBe('contradiction');
    expect(view.verdictLabel).toBe('Sources contradict');
  });

  it('renders stance counts and a Tier-1 descriptor alongside Tier-0', () => {
    const stanceMaster = {
      ...master,
      stanceMode: {
        evidenceAxis: 'stance',
        sourceCount: 4,
        groundedCount: 4,
        requiredSources: 4,
        requiredGrounded: 3,
        confidenceFloor: 0.6,
        quorumMet: true,
      },
      stanceSummary: { support: 3, oppose: 1 },
      verdictDescriptor: {
        term: 'broad-institutional-support',
        parent: 'align' as const,
        definition: 'Support appears across several institution types.',
      },
    };
    const view = toHumanView(
      wrapMasterReceipt(stanceMaster, {
        claim: master.claim,
        source: 'uvrn-sdk',
        action: 'master.measured',
      })
    );

    expect(view.headline).toBe(
      '3 support / 1 oppose — sources align · broad-institutional-support'
    );
    expect(view.stanceSummary).toEqual({ support: 3, oppose: 1 });
    expect(view.verdictLabel).toBe('Sources align');
    expect(view.verdictDescriptor).toEqual(stanceMaster.verdictDescriptor);
  });

  it('renders a delta receipt with source labels and signature provenance', () => {
    const delta = makeDeltaReceipt();
    const view = toHumanView(
      wrapDeltaReceipt(delta, { claim: 'fixture claim', source: 'uvrn-sdk', action: 'delta.consensus' }),
      { verifyBaseUrl: 'http://localhost:4173/access/receipt/', registeredAt: '2026-06-10T12:11:00.000Z' }
    );
    expect(view.sources.map((s) => s.name)).toEqual(delta.sources);
    expect(view.measurements).toEqual([]);
    expect(view.provenance.registeredAt).toBe('2026-06-10T12:11:00.000Z');
    expect(view.provenance.verifyUrl).toContain('http://localhost:4173');
  });
});

describe('enrichMeasurements + verifyDetachedSignature (Phase 2 additions)', () => {
  const { enrichMeasurements, verifyDetachedSignature, generateReceiptKeyPair, signReceipt } =
    require('../src');

  it('stamps humanExplanation from the vocabulary without mutating input', () => {
    const input = [
      { type: 'agree', verdict: 'agree', confidence: 1, explanation: 'tech', evidenceRefs: [] },
      { type: 'x', verdict: 'conflict', confidence: 1, explanation: 'tech', evidenceRefs: [], humanExplanation: 'kept' },
    ];
    const enriched = enrichMeasurements(input);
    expect(enriched[0].humanExplanation).toContain('Sources align');
    expect(enriched[1].humanExplanation).toBe('kept');
    expect((input[0] as { humanExplanation?: string }).humanExplanation).toBeUndefined();
  });

  it('verifies a detached signature from hash + schemaVersion alone', () => {
    const keys = generateReceiptKeyPair();
    const delta = makeDeltaReceipt();
    const signed = signReceipt(
      wrapDeltaReceipt(delta, { claim: 'detached fixture', source: 's', action: 'a' }),
      { privateKey: keys.privateKey, publicKeyRef: 'det-pk-1' }
    );
    const ok = verifyDetachedSignature(
      { receiptHash: signed.receiptHash, schemaVersion: signed.schemaVersion, signature: signed.signature! },
      keys.publicKey
    );
    expect(ok.signatureOk).toBe(true);
    const bad = verifyDetachedSignature(
      { receiptHash: signed.receiptHash.replace(/.$/, '0'), schemaVersion: signed.schemaVersion, signature: signed.signature! },
      keys.publicKey
    );
    expect(bad.signatureOk).toBe(false);
  });
});
