import { runDeltaEngine } from '@uvrn/core';

import {
  ConsensusEngine,
  evaluateStanceMode,
  type FarmResult,
  type FarmSource,
} from '../src';

const activated = require('../../SPEC/vectors/stance-quorum-met.json');
const opposing = require('../../SPEC/vectors/stance-opposing-conflict.json');
const fallback = require('../../SPEC/vectors/stance-quorum-fallback.json');
const frozen = require('../../SPEC/vectors/stance-no-stance-regression-4.0.0.json');

function farmSourcesFromStanceVector(
  vector: {
    input: { sources: Array<Partial<FarmSource> & { label?: string }> };
  },
  claimId: string
): { sources: FarmSource[]; farmResult: FarmResult } {
  const sources: FarmSource[] = vector.input.sources.map((source, index) => {
    const publishedAt = '2026-07-18T10:00:00.000Z';
    return {
      ...source,
      url: `https://example.test/${claimId}/${index}`,
      title: source.label ?? `Source ${index}`,
      snippet: 'No numeric prose is used.',
      evidenceScore: 10 + index * 10,
      credibility: 0.8,
      publishedAt,
      // BP-20: freshness/ts use measuredAt. Hydrate for pre-BP-20 fixtures.
      measuredAt: publishedAt,
    };
  });
  return {
    sources,
    farmResult: {
      claimId,
      fetchedAt: '2026-07-18T12:00:00.000Z',
      durationMs: 0,
      sources,
    },
  };
}

/** Hydrate measuredAt onto legacy SPEC farm fixtures (no SPEC edit). */
function withMeasuredAt(farmResult: FarmResult): FarmResult {
  return {
    ...farmResult,
    sources: farmResult.sources.map((source) => {
      const publishedAt = (source as { publishedAt?: string }).publishedAt;
      return {
        ...source,
        measuredAt: source.measuredAt ?? publishedAt,
      };
    }),
  };
}

/**
 * Pre-BP-20 stance vectors freeze consensusResult without MetricPoint.measuredAt.
 * Strip the additive field for byte-compare; DeltaReceipt hash law is checked separately.
 */
function stripMeasuredAtForLegacyCompare(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key === 'measuredAt' ? undefined : v))
  );
}

describe('dual-axis consensus BP-01 vectors', () => {
  it('activates stance and uses stanceValue only for delta metrics', () => {
    const { sources, farmResult } = farmSourcesFromStanceVector(
      activated,
      'stance-activated'
    );
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

  it('locks stance-opposing-conflict axis activation and stanceValue metrics', () => {
    const { sources, farmResult } = farmSourcesFromStanceVector(
      opposing,
      'stance-opposing-conflict'
    );
    const engine = new ConsensusEngine({
      sources: farmResult,
      claim: opposing.claim,
      dedup: { mode: 'off' },
    });
    const result = engine.buildConsensusResult();

    expect(engine.stanceMode()).toEqual(opposing.expected.stanceMode);
    expect(result.stats.evidenceAxis).toBe('stance');
    expect(
      result.bundle.dataSpecs.map(
        (spec) => spec.metrics.find((metric) => metric.key === 'consensus_value')?.value
      )
    ).toEqual(sources.map((source) => source.stanceValue));
    // Opposing dual-axis activation must stay green in consensus CI (not measure-only).
    expect(sources.map((source) => source.stanceLabel)).toEqual([
      'supports',
      'opposes',
      'supports',
      'opposes',
    ]);
  });

  it('keeps the grounded-quorum fallback result byte-for-byte unchanged', () => {
    const farmResult = withMeasuredAt(fallback.input.farmResult as FarmResult);
    const engine = new ConsensusEngine({
      sources: farmResult,
      claim: fallback.claim,
    });
    const actual = engine.buildConsensusResult();

    expect(evaluateStanceMode(farmResult.sources)).toEqual(fallback.expected.stanceMode);
    expect(JSON.stringify(stripMeasuredAtForLegacyCompare(actual))).toBe(
      JSON.stringify(fallback.expected.consensusResult)
    );
  });

  it('keeps frozen no-stance consensus and DeltaReceipt bytes identical', () => {
    const farmResult = withMeasuredAt(frozen.input.farmResult as FarmResult);
    const engine = new ConsensusEngine({
      sources: farmResult,
      claim: frozen.input.claim,
    });
    const consensusResult = engine.buildConsensusResult();
    const deltaReceipt = runDeltaEngine(consensusResult.bundle, {
      timestamp: frozen.input.engineTimestamp,
    });

    expect(JSON.stringify(stripMeasuredAtForLegacyCompare(consensusResult))).toBe(
      JSON.stringify(frozen.expected.consensusResult)
    );
    expect(JSON.stringify(deltaReceipt)).toBe(
      JSON.stringify(frozen.expected.deltaReceipt)
    );
  });
});
