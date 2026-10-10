/**
 * Shared test fixtures: a real v3 DeltaReceipt (hashed with @uvrn/core's frozen path) and a
 * MasterReceipt built with @uvrn/core, so tests prove compatibility with live protocol law.
 */

import {
  buildMasterReceipt,
  hashReceipt,
  type DeltaReceipt,
  type MasterReceipt,
} from '@uvrn/core';

export function makeDeltaReceipt(): DeltaReceipt {
  const payload: Omit<DeltaReceipt, 'hash'> = {
    bundleId: 'bundle-fixture-1',
    deltaFinal: 0.042,
    sources: ['Source A', 'Source B', 'Source C'],
    rounds: [
      {
        round: 1,
        deltasByMetric: { price: 0.042 },
        withinThreshold: true,
        witnessRequired: false,
      },
    ],
    suggestedFixes: [],
    outcome: 'consensus',
    ts: '2026-06-10T12:00:00.000Z',
  };
  return { ...payload, hash: hashReceipt(payload) };
}

export function makeMasterReceipt(): MasterReceipt {
  return buildMasterReceipt({
    base: makeDeltaReceipt(),
    claim: 'BTC traded above 100k on 2026-06-09',
    timestamp: '2026-06-10T12:05:00.000Z',
    measurements: [
      {
        type: 'agree',
        verdict: 'agree',
        confidence: 0.96,
        explanation: 'Sources converge with agreement score 0.960 at threshold 0.9.',
        evidenceRefs: ['source-a', 'source-b'],
      },
      {
        type: 'disagree',
        verdict: 'none',
        confidence: 0.96,
        explanation: 'Numeric spread 0.040 does not exceed disagreement threshold 0.1.',
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
