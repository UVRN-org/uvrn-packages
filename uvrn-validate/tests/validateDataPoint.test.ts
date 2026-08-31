import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MeasurementSource } from '@uvrn/core';
import { validateDataPoint } from '../src';

const okPoint = {
  id: 'dp-1',
  kind: 'metric',
  value: 42,
};

const twoSources: MeasurementSource[] = [
  { id: 'a', kind: 'numeric', value: 100, label: 'A', status: 'on' },
  { id: 'b', kind: 'numeric', value: 101, label: 'B', status: 'on' },
];

function collectTokens(result: ReturnType<typeof validateDataPoint>): string[] {
  const tokens: string[] = [result.stage1];
  if (result.stage2) {
    tokens.push(result.stage2.token);
    for (const m of result.stage2.measurements ?? []) {
      tokens.push(m.verdict);
    }
  }
  return tokens;
}

describe('@uvrn/validate package identity', () => {
  it('package.json name is @uvrn/validate', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as { name: string };
    expect(pkg.name).toBe('@uvrn/validate');
  });
});

describe('Stage1 shape/presence', () => {
  it('returns structurally-ok for a well-formed DataPoint', () => {
    const result = validateDataPoint(okPoint);
    expect(result.stage).toBe(1);
    expect(result.stage1).toBe('structurally-ok');
    expect(result.reasons).toEqual([]);
    expect(result.stage2).toBeUndefined();
    expect(collectTokens(result)).not.toContain('integrity-checked');
    expect(collectTokens(result)).not.toContain('verified');
  });

  it('returns malformed when id/kind/value are missing', () => {
    const result = validateDataPoint({ id: '', kind: '', /* no value */ });
    expect(result.stage).toBe(1);
    expect(result.stage1).toBe('malformed');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.includes('id'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('kind'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('value'))).toBe(true);
    expect(collectTokens(result)).not.toContain('integrity-checked');
    expect(collectTokens(result)).not.toContain('verified');
  });

  it('returns malformed for non-object input', () => {
    const result = validateDataPoint(null);
    expect(result.stage1).toBe('malformed');
    expect(result.stage2).toBeUndefined();
  });

  it('never emits integrity-checked or verified from Stage1', () => {
    const ok = validateDataPoint(okPoint);
    const bad = validateDataPoint({});
    for (const result of [ok, bad]) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/integrity-checked/);
      expect(serialized).not.toMatch(/"verified"/);
    }
  });
});

describe('Stage2 flag gate', () => {
  it('flag off skips measure (no stage2 field)', () => {
    const result = validateDataPoint(okPoint, {
      runStage2: false,
      sources: twoSources,
    });
    expect(result.stage).toBe(1);
    expect(result.stage1).toBe('structurally-ok');
    expect(result.stage2).toBeUndefined();
  });

  it('flag omitted skips measure even when sources are present', () => {
    const result = validateDataPoint(okPoint, { sources: twoSources });
    expect(result.stage).toBe(1);
    expect(result.stage2).toBeUndefined();
  });

  it('flag on with <2 host sources → insufficient-data (honest success)', () => {
    const result = validateDataPoint(okPoint, {
      runStage2: true,
      sources: [twoSources[0]!],
    });
    expect(result.stage).toBe(2);
    expect(result.stage1).toBe('structurally-ok');
    expect(result.stage2?.token).toBe('insufficient-data');
    expect(result.stage2?.measurements).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/"verified"/);
  });

  it('flag on with zero sources → insufficient-data', () => {
    const result = validateDataPoint(okPoint, { runStage2: true });
    expect(result.stage2?.token).toBe('insufficient-data');
  });

  it('flag on with ≥2 sources routes into @uvrn/measure vocabulary', () => {
    const result = validateDataPoint(okPoint, {
      runStage2: true,
      sources: twoSources,
      claim: 'Values should agree',
    });
    expect(result.stage).toBe(2);
    expect(result.stage1).toBe('structurally-ok');
    expect(result.stage2).toBeDefined();
    expect(result.stage2!.measurements).toBeDefined();
    expect(result.stage2!.measurements!.length).toBeGreaterThan(0);
    expect(result.stage2!.measurements!.map((m) => m.type)).toEqual(
      expect.arrayContaining(['agree', 'disagree', 'conflict', 'potential'])
    );
    // Measure vocab only — never verified from this surface.
    expect(JSON.stringify(result)).not.toMatch(/"verified"/);
    expect(JSON.stringify(result)).not.toMatch(/integrity-checked/);
  });

  it('headline token forwards agree no-agreement when numerics diverge', () => {
    const diverging: MeasurementSource[] = [
      { id: 'a', kind: 'numeric', value: 100, label: 'A', status: 'on' },
      { id: 'b', kind: 'numeric', value: 150, label: 'B', status: 'on' },
    ];
    const result = validateDataPoint(okPoint, {
      runStage2: true,
      sources: diverging,
      claim: 'sources diverge',
    });
    expect(result.stage2?.token).toBe('no-agreement');
    const agree = result.stage2?.measurements?.find((m) => m.type === 'agree');
    expect(agree?.verdict).toBe('no-agreement');
    expect(JSON.stringify(result)).not.toMatch(/"verified"/);
  });

  it('sourceRef does not feed Stage2 (host-sources-only)', () => {
    const result = validateDataPoint(
      { ...okPoint, sourceRef: 'connector://would-fetch' },
      { runStage2: true }
    );
    expect(result.stage).toBe(2);
    expect(result.stage2?.token).toBe('insufficient-data');
    expect(result.stage2?.measurements).toBeUndefined();
  });

  it('malformed Stage1 does not run Stage2 even with flag on', () => {
    const result = validateDataPoint({ id: 'x' }, {
      runStage2: true,
      sources: twoSources,
    });
    expect(result.stage).toBe(1);
    expect(result.stage1).toBe('malformed');
    expect(result.stage2).toBeUndefined();
  });
});
