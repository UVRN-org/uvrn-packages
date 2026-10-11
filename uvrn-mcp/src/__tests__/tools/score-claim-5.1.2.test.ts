import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDescriptor } from '@uvrn/receipt';
import { scoreClaimSchema } from '../../tools/schemas';

/**
 * 5.1.2 regressions found while recording real `delta_score_claim` sessions for uvrn.org.
 * Inputs mirror the recorded sessions: example.org sources, explicit stance fields.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadHandlers() {
  const [{ buildHandlers }, { resolveRuntimeConfig }] = await Promise.all([
    import('../../tools/handlers'),
    import('../../config'),
  ]);
  return buildHandlers(resolveRuntimeConfig({} as any));
}

type Label = 'supports' | 'opposes';

function stanceSource(key: string, stanceLabel: Label, extra: Record<string, unknown> = {}) {
  return {
    url: `https://example.org/${key}`,
    title: `Source ${key}`,
    snippet: `Reporting from ${key}.`,
    publishedAt: '2026-10-01T09:00:00.000Z',
    stanceLabel,
    stanceEvidence: `${key} gives a reason for its position.`,
    stanceConfidence: 0.8,
    ...extra,
  };
}

describe('delta_score_claim — same-day reprints (insufficient independent sources)', () => {
  const reprints = [
    {
      url: 'https://example.org/wire',
      title: 'Wire report',
      snippet: 'The index closed at 100.',
      publishedAt: '2026-10-01T09:00:00.000Z',
      value: 100,
    },
    {
      url: 'https://example.org/reprint',
      title: 'Reprint of the wire report',
      snippet: 'The index closed at 100.5.',
      publishedAt: '2026-10-01T15:00:00.000Z',
      value: 100.5,
    },
  ];

  it('returns an honest insufficient result instead of an execution error', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'The index closed at 100', sources: reprints });

    expect(result.insufficientIndependentSources).toEqual({
      inputCount: 2,
      usableCount: 2,
      retainedCount: 1,
      requiredCount: 2,
      shortfall: 1,
      deduplicatedCount: 1,
      reason: expect.stringContaining('near-identical'),
    });
    expect(result.absoluteConsensusValue).toMatchObject({ n: 1 });
    expect(result.evidenceMode).toBe('host_sources');
    expect(result.sourceCount).toBe(1);
    // Nothing was scored, so nothing is sealed or signed.
    expect('masterReceipt' in result).toBe(false);
    expect('networkReceipt' in result).toBe(false);
    expect('v_score' in result).toBe(false);
    expect(result.stanceCounts.quorum.met).toBe(false);
  });
});

describe('delta_score_claim — stance quorum met without numeric stanceValue', () => {
  const labelOnly = [
    stanceSource('a', 'supports'),
    stanceSource('b', 'supports'),
    stanceSource('c', 'opposes'),
    stanceSource('d', 'supports'),
  ];

  it('refuses honestly and never derives stanceValue from stanceLabel', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'Label-only stance claim', sources: labelOnly });

    expect(result.insufficientIndependentSources).toMatchObject({
      inputCount: 4,
      usableCount: 0,
      retainedCount: 0,
      requiredCount: 2,
      shortfall: 2,
    });
    const reason = result.insufficientIndependentSources!.reason;
    expect(reason).toContain('stanceValue');
    expect(reason).toContain('never derived from stanceLabel');
    expect(result.stanceCounts.quorum).toMatchObject({ evidenceAxis: 'stance', met: true });
    expect('networkReceipt' in result).toBe(false);
  });

  it('documents the stanceValue requirement in the tool schema', () => {
    const stanceValue = scoreClaimSchema.properties.sources.items.properties.stanceValue;
    expect(stanceValue.description).toContain('Required for stance agreement');
    expect(stanceValue.description).toContain('never derived from stanceLabel');
  });
});

describe('delta_score_claim — graded unanimous stance', () => {
  const graded = [0.9, 0.8, 0.7, 0.6].map((stanceValue, index) =>
    stanceSource(`graded-${index}`, 'supports', { stanceValue })
  );

  it('keeps the Tier-0 split verdict but says every source is on the same side', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'Graded support claim', sources: graded });

    const descriptor = result.humanView.verdictDescriptor;
    expect(descriptor).toMatchObject({ term: 'same-side-graded', parent: 'split' });
    expect(validateDescriptor(descriptor!).valid).toBe(true);
    expect(result.humanView.headline).toContain('4 support / 0 oppose');
    expect(result.humanView.headline).toContain('same-side-graded');

    const disagree = result.masterReceipt.measurements.find((m) => m.type === 'disagree');
    expect(disagree?.verdict).toBe('disagree');
    expect(disagree?.humanExplanation).not.toContain('different directions');
    expect(disagree?.humanExplanation).toContain('same side');
  });

  it('does not attach the descriptor when sources take opposite sides', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Opposed stance claim',
      sources: [
        stanceSource('p', 'supports', { stanceValue: 0.9 }),
        stanceSource('q', 'supports', { stanceValue: 0.6 }),
        stanceSource('r', 'opposes', { stanceValue: -0.7 }),
        stanceSource('s', 'supports', { stanceValue: 0.8 }),
      ],
    });

    expect(result.humanView.verdictDescriptor).toBeUndefined();
    expect((result.networkReceipt.payload as { verdictDescriptor?: unknown }).verdictDescriptor)
      .toBeUndefined();
  });
});

describe('delta_score_claim — stance-axis counts and score basis', () => {
  const graded = [0.9, 0.85, 0.8, 0.75].map((stanceValue, index) =>
    stanceSource(`count-${index}`, 'supports', { stanceValue })
  );

  it('counts each host source in the signed narrative and the human view', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'Four source claim', sources: graded });

    expect(result.networkReceipt.narrative).toContain('4 of 4 sources weighed in');
    expect(result.masterReceipt.nodes).toHaveLength(4);
    expect(result.humanView.sources.map((s) => s.name)).toEqual(graded.map((s) => s.url));
  });

  it('says the quality score was not measured instead of presenting zeros as a score', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'Four source claim', sources: graded });

    expect(result.scoreBasis).toEqual({
      measured: false,
      reason: expect.stringContaining('measuredAt'),
    });
    expect(result.humanView.scoreCard.vScore).toBeUndefined();
    expect(result.humanView.scoreCard.completeness).toBeUndefined();
  });

  it('keeps the score card when sources carry a numeric value', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Four source claim',
      sources: graded.map((s, i) => ({ ...s, evidenceScore: 60 + i * 10 })),
    });

    expect(result.scoreBasis).toBeUndefined();
    expect(typeof result.humanView.scoreCard.vScore).toBe('number');
  });
});

describe('delta_verify_receipt — honest vocabulary', () => {
  it('reports integrityOk only; no `verified` flag without a signature check', async () => {
    const { handleRunEngine, handleVerifyReceipt } = await loadHandlers();
    const { createTestBundle } = await import('../fixtures/bundles');
    const receipt = (await handleRunEngine({ bundle: createTestBundle() })).receipt;

    const ok = await handleVerifyReceipt({ receipt });
    expect(ok.integrityOk).toBe(true);
    expect('verified' in ok).toBe(false);

    expect(ok.details).toContain('carry no signature');
    expect(ok.details).not.toContain('from @uvrn/receipt for integrity plus signature');

    const bad = await handleVerifyReceipt({ receipt: { bundleId: 'missing-hash' } as any });
    expect(bad.integrityOk).toBe(false);
    expect('verified' in bad).toBe(false);
  });
});

describe('@uvrn/mcp manifest', () => {
  it('pins @modelcontextprotocol/sdk to the tested 1.x floor, not ^1.0.0', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'));
    expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBe('^1.27.1');
  });
});

describe('delta_score_claim — identical same-day stance values', () => {
  it('names the dedup rule instead of crashing (independence of identical stances is open — see CHANGELOG)', async () => {
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Unanimous stance claim',
      sources: ['a', 'b', 'c', 'd'].map((k) => stanceSource(k, 'supports', { stanceValue: 0.9 })),
    });

    expect(result.insufficientIndependentSources).toMatchObject({ usableCount: 4, retainedCount: 1 });
    expect(result.insufficientIndependentSources!.reason).toContain('within 24 hours are treated as one');
  });
});
