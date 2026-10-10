/**
 * D3 actionable explanations — disagree→agree drivers on humanView (render-only).
 */

import {
  buildMasterReceipt,
  hashReceipt,
  type DeltaReceipt,
} from '@uvrn/core';
import {
  buildActionableExplanation,
  computeNetworkReceiptHash,
  toHumanView,
  wrapMasterReceipt,
} from '../src';
import { makeMasterReceipt } from './fixtures';

function makeSplitMaster() {
  const payload: Omit<DeltaReceipt, 'hash'> = {
    bundleId: 'bundle-d3-split',
    deltaFinal: 0.2,
    sources: ['Source A', 'Source B', 'Source C'],
    rounds: [
      {
        round: 1,
        deltasByMetric: { price: 0.2 },
        withinThreshold: false,
        witnessRequired: false,
      },
    ],
    suggestedFixes: [],
    outcome: 'indeterminate',
    ts: '2026-08-02T12:00:00.000Z',
  };
  const base: DeltaReceipt = { ...payload, hash: hashReceipt(payload) };
  return buildMasterReceipt({
    base,
    claim: 'Split claim for D3 drivers',
    timestamp: '2026-08-02T12:05:00.000Z',
    measurements: [
      {
        type: 'agree',
        verdict: 'no-agreement',
        confidence: 0.818,
        explanation: 'Sources do not reach agreement: score 0.818 is below threshold 0.9.',
        evidenceRefs: ['source-a', 'source-b'],
      },
      {
        type: 'disagree',
        verdict: 'disagree',
        confidence: 0.182,
        explanation: 'Numeric sources diverge by 0.182, above threshold 0.1.',
        evidenceRefs: ['source-a', 'source-b'],
      },
    ],
    nodes: [
      { id: 'source-a', status: 'on' },
      { id: 'source-b', status: 'on' },
      { id: 'source-c', status: 'unavailable', detail: 'timeout after 5s' },
    ],
  });
}

describe('buildActionableExplanation (D3 AC)', () => {
  it('lists primary measurement drivers with disagree→agree counterfactuals', () => {
    const explanation = buildActionableExplanation({
      measurements: [
        {
          type: 'agree',
          verdict: 'no-agreement',
          confidence: 0.818,
          plainExplanation:
            'Sources do not reach agreement: score 0.818 is below threshold 0.9.',
          whyItMatters: 'split',
        },
        {
          type: 'disagree',
          verdict: 'disagree',
          confidence: 0.182,
          plainExplanation: 'Numeric sources diverge by 0.182, above threshold 0.1.',
          whyItMatters: 'split',
        },
      ],
      verdictTone: 'split',
    });
    expect(explanation?.question).toBe('disagree-to-agree');
    expect(explanation?.primaryDrivers.some((d) => d.id === 'measurement.disagree')).toBe(true);
    expect(explanation?.primaryDrivers.some((d) => d.id === 'measurement.agree.no-agreement')).toBe(
      true
    );
    const agreeDriver = explanation!.primaryDrivers.find(
      (d) => d.id === 'measurement.agree.no-agreement'
    )!;
    expect(agreeDriver.counterfactual).toBe(
      "They'd need to get closer — at least to about 0.9 — before this counts as agreement."
    );
    expect(agreeDriver.fact).toBe(
      "Sources aren't lined up yet — agreement is only about 0.818, short of what counts as agree."
    );
    expect(agreeDriver.anchor).toBe('measurements[agree].explanation');
  });

  it('anchors stance + D2 quality + gap facts without invented ranking', () => {
    const explanation = buildActionableExplanation({
      measurements: [
        {
          type: 'disagree',
          verdict: 'disagree',
          confidence: 0.5,
          plainExplanation: 'Numeric sources diverge by 0.500, above threshold 0.1.',
          whyItMatters: 'split',
        },
      ],
      verdictTone: 'split',
      stanceSummary: { support: 2, oppose: 1 },
      sourceQualityDiagnostics: [
        {
          code: 'evidenceScore.weak',
          kind: 'weak',
          sourceId: 'weak-a',
          field: 'evidenceScore',
          note: 'Declared evidenceScore 10 is below weak floor 30.',
        },
      ],
      gaps: [
        {
          what: 'Source source-c was unreachable',
          plainNote: 'Could not be reached in time.',
        },
      ],
    });
    expect(explanation?.primaryDrivers.some((d) => d.kind === 'stance')).toBe(true);
    expect(explanation?.primaryDrivers.some((d) => d.kind === 'source-quality')).toBe(true);
    expect(explanation?.primaryDrivers.some((d) => d.kind === 'gap')).toBe(true);
    for (const d of explanation!.primaryDrivers) {
      const blob = `${d.fact} ${d.counterfactual ?? ''}`;
      expect(blob).not.toMatch(/high(?:ly)?\s+confiden/i);
      expect(blob).not.toMatch(/\bproven\b/i);
      expect(blob).not.toMatch(/buy now|act now|guaranteed/i);
    }
  });

  it('returns undefined when sources are aligned with no disagree/no-agreement', () => {
    expect(
      buildActionableExplanation({
        measurements: [
          {
            type: 'agree',
            verdict: 'agree',
            confidence: 0.96,
            plainExplanation: 'Sources converge with agreement score 0.960 at threshold 0.9.',
            whyItMatters: 'aligned',
          },
          {
            type: 'disagree',
            verdict: 'none',
            confidence: 0.96,
            plainExplanation:
              'Numeric spread 0.040 does not exceed disagreement threshold 0.1.',
            whyItMatters: 'aligned',
          },
        ],
        verdictTone: 'aligned',
      })
    ).toBeUndefined();
  });
});

describe('toHumanView actionableExplanation path', () => {
  const master = makeSplitMaster();
  const wrapped = wrapMasterReceipt(master, {
    claim: master.claim,
    source: 'uvrn-sdk',
    action: 'master.measured',
    topic: 'markets/crypto/BTC',
  });

  it('attaches actionableExplanation on split receipts', () => {
    const view = toHumanView(wrapped);
    expect(view.verdictTone).toBe('split');
    expect(view.actionableExplanation?.question).toBe('disagree-to-agree');
    expect(
      view.actionableExplanation?.primaryDrivers.some((d) => d.kind === 'measurement')
    ).toBe(true);
    expect(
      view.actionableExplanation?.primaryDrivers.some((d) => d.kind === 'gap')
    ).toBe(true);
  });

  it('includes optional spreadDriverFacts from host options', () => {
    const view = toHumanView(wrapped, {
      spreadDriverFacts: [
        {
          id: 'spread.incomplete',
          anchor: 'reportSpread.incompleteReasons',
          fact: "We can't yet say how far demand and supply sit apart — missing supply class.",
          counterfactual:
            'Once both sides are present, we could describe that gap as a state of the numbers — not as market advice.',
        },
      ],
    });
    expect(view.actionableExplanation?.primaryDrivers.some((d) => d.kind === 'spread')).toBe(
      true
    );
  });

  it('does not change receiptHash (render-only; no hashed field list break)', () => {
    const baseHash = computeNetworkReceiptHash(wrapped);
    const view = toHumanView(wrapped);
    expect(view.actionableExplanation).toBeDefined();
    expect(computeNetworkReceiptHash(wrapped)).toBe(baseHash);
  });

  it('omits actionableExplanation on aligned default fixture', () => {
    const aligned = wrapMasterReceipt(makeMasterReceipt(), {
      claim: 'aligned',
      source: 'uvrn-sdk',
      action: 'master.measured',
      topic: 'markets/crypto/BTC',
    });
    const view = toHumanView(aligned);
    expect(view.verdictTone).toBe('aligned');
    expect(view.actionableExplanation).toBeUndefined();
  });
});
