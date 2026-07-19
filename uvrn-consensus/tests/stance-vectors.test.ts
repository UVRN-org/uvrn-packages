import { runDeltaEngine } from '@uvrn/core';

import {
  ConsensusEngine,
  evaluateStanceMode,
  type FarmResult,
  type FarmSource,
} from '../src';

const activated = require('../../SPEC/vectors/stance-quorum-met.json');
const fallback = require('../../SPEC/vectors/stance-quorum-fallback.json');
const frozen = require('../../SPEC/vectors/stance-no-stance-regression-4.0.0.json');

describe('dual-axis consensus BP-01 vectors', () => {
  it('activates stance and uses stanceValue only for delta metrics', () => {
    const sources: FarmSource[] = activated.input.sources.map(
      (source: Partial<FarmSource> & { label?: string }, index: number) => ({
        ...source,
        url: `https://example.test/${index}`,
        title: source.label ?? `Source ${index}`,
        snippet: 'No numeric prose is used.',
        evidenceScore: 10 + index * 10,
        credibility: 0.8,
        publishedAt: '2026-07-18T10:00:00.000Z',
      })
    );
    const farmResult: FarmResult = {
      claimId: 'stance-activated',
      fetchedAt: '2026-07-18T12:00:00.000Z',
      durationMs: 0,
      sources,
    };
    const engine = new ConsensusEngine({
      sources: farmResult,
      claim: activated.claim,
      dedup: { mode: 'off' },
    });
    const result = engine.buildConsensusResult();

    expect(engine.stanceMode()).toEqual(activated.expected.stanceMode);
    expect(result.stats.evidenceAxis).toBe('stance');
    expect(
      result.bundle.dataSpecs.map(
        (spec) => spec.metrics.find((metric) => metric.key === 'consensus_value')?.value
      )
    ).toEqual(sources.map((source) => source.stanceValue));
    // Parity remains prominence-derived; stance changes only agreement/delta.
    expect(result.components.parity).toBe(25);
  });

  it('keeps the grounded-quorum fallback result byte-for-byte unchanged', () => {
    const farmResult = fallback.input.farmResult as FarmResult;
    const engine = new ConsensusEngine({
      sources: farmResult,
      claim: fallback.claim,
    });
    const actual = engine.buildConsensusResult();

    expect(evaluateStanceMode(farmResult.sources)).toEqual(fallback.expected.stanceMode);
    expect(JSON.stringify(actual)).toBe(
      JSON.stringify(fallback.expected.consensusResult)
    );
  });

  it('keeps frozen no-stance consensus and DeltaReceipt bytes identical', () => {
    const farmResult = frozen.input.farmResult as FarmResult;
    const engine = new ConsensusEngine({
      sources: farmResult,
      claim: frozen.input.claim,
    });
    const consensusResult = engine.buildConsensusResult();
    const deltaReceipt = runDeltaEngine(consensusResult.bundle, {
      timestamp: frozen.input.engineTimestamp,
    });

    expect(JSON.stringify(consensusResult)).toBe(
      JSON.stringify(frozen.expected.consensusResult)
    );
    expect(JSON.stringify(deltaReceipt)).toBe(
      JSON.stringify(frozen.expected.deltaReceipt)
    );
  });
});
