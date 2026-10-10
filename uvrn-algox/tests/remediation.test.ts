import { buildContext } from '../src/pipeline';
import { rankSignals } from '../src/presets/signals';
import { dedupByKey } from '../src/stages/filters/dedupByKey';
import { dropMissing } from '../src/stages/filters/dropMissing';
import { weightedScorer } from '../src/stages/scorers/weightedScorer';
import { topK } from '../src/stages/selectors/topK';
import { hostOf, normalizeUrl } from '../src/util/normalizeUrl';

describe('v2 remediation', () => {
  it('falls back from invalid now and emits a warning', async () => {
    const result = await rankSignals(
      [{ label: 'a', prominence: 1 }],
      { now: 'not-a-date', maxAgeDays: null }
    );

    expect(result.ranked).toHaveLength(1);
    expect(result.config.now).not.toBe('not-a-date');
    expect(result.warnings.some((warning) => warning.code === 'invalid_now')).toBe(true);
  });

  it('keeps default prominence scoring when weights is empty', async () => {
    const result = await rankSignals(
      [
        { label: 'low', prominence: 1 },
        { label: 'high', prominence: 10 },
      ],
      { weights: {}, maxAgeDays: null }
    );

    expect(result.ranked[0].label).toBe('high');
    expect(result.config.weights).toEqual({ prominence: 1 });
  });

  it('coerces non-finite numeric fields to zero', async () => {
    const ctx = buildContext({
      candidates: [
        { label: 'bad-top', prominence: Number.NaN },
        { label: 'bad-nested', signals: { mentions: Number.POSITIVE_INFINITY } },
        { label: 'good', prominence: 3, signals: { mentions: 4 } },
      ],
    });

    await weightedScorer({ weights: { prominence: 1, mentions: 1 } }).run(ctx);

    expect(ctx.candidates.map((candidate) => candidate.score)).toEqual([0, 0, 7]);
  });

  it('lets dedupByKey prefer the stronger duplicate', async () => {
    const ctx = buildContext({
      candidates: [
        { label: 'weak', url: 'https://example.com/a', prominence: 10 },
        { label: 'strong', url: 'https://example.com/a/', prominence: 20 },
      ],
    });

    await dedupByKey(
      (candidate) => normalizeUrl(candidate.url ?? ''),
      { prefer: (candidate, existing) => (candidate.prominence ?? 0) - (existing.prominence ?? 0) }
    ).run(ctx);

    expect(ctx.candidates.map((candidate) => candidate.label)).toEqual(['strong']);
    expect(ctx.dropped.map((candidate) => candidate.label)).toEqual(['weak']);
  });

  it('uses hostname fallback for source-less grouping', async () => {
    const result = await rankSignals(
      [
        { label: 'a', url: 'https://www.example.com/a', prominence: 30 },
        { label: 'b', url: 'https://m.example.com/b', prominence: 20 },
        { label: 'c', url: 'https://other.com/c', prominence: 10 },
      ],
      { capPerSource: 1, maxAgeDays: null }
    );

    expect(result.ranked.map((candidate) => candidate.label).sort()).toEqual(['a', 'c']);
    expect(result.dropped.some((candidate) => candidate.label === 'b' && candidate.reason === 'group_cap_exceeded')).toBe(true);
  });

  it('normalizes common host prefixes', () => {
    expect(normalizeUrl('https://www.example.com/a/')).toBe('example.com/a');
    expect(normalizeUrl('https://m.example.com/a')).toBe('example.com/a');
    expect(normalizeUrl('https://amp.example.com/a')).toBe('example.com/a');
    expect(hostOf('https://www.example.com/a')).toBe('example.com');
  });

  it('drops whitespace-only required fields', async () => {
    const ctx = buildContext({ candidates: [{ label: '   ' }, { label: 'ok' }] });

    await dropMissing('label').run(ctx);

    expect(ctx.candidates.map((candidate) => candidate.label)).toEqual(['ok']);
    expect(ctx.dropped[0].reason).toBe('missing_label');
  });

  it('clamps nonsensical knobs and warns', async () => {
    const result = await rankSignals(
      [
        { label: 'a', prominence: 3 },
        { label: 'b', prominence: 2 },
      ],
      {
        topK: 0,
        capPerSource: 0,
        maxAgeDays: null,
        weights: { prominence: -1 },
      }
    );

    expect(result.config.topK).toBe(1);
    expect(result.config.capPerSource).toBe(1);
    expect(result.warnings.some((warning) => warning.code === 'invalid_topk')).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'invalid_cap_per_source')).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'negative_weight')).toBe(true);
  });

  it('warns when selected count is below topK and leaves candidates consistent', async () => {
    const ctx = buildContext({ candidates: [{ label: 'a' }] });

    await topK({ k: 3 }).run(ctx);

    expect(ctx.selected).toHaveLength(1);
    expect(ctx.candidates).toEqual(ctx.selected);
    expect(ctx.warnings.some((warning) => warning.code === 'insufficient_candidates')).toBe(true);
  });
});
