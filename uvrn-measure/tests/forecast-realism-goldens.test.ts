/**
 * D5 golden / forecast realism — messy short-horizon market cases via typed observations.
 * Loads SPEC vector + case-bank additive fixtures; uses withTypedObservation (D1 path).
 * Does not scrape titles; does not retune agree thresholds.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  agreeMeasurement,
  disagreeMeasurement,
  withTypedObservation,
} from '../src';

const here = dirname(__filename);
const repoRoot = join(here, '../..');
const vectorPath = join(
  repoRoot,
  'SPEC/vectors/typed-observation-forecast-realism.json'
);
const fixtureDir = join(
  repoRoot,
  'uvrn-case-bank/fixtures/forecast-realism'
);

type SpecCase = {
  id: string;
  name: string;
  claim: string;
  sources: Array<{
    id?: string;
    kind?: 'numeric' | 'categorical' | 'boolean' | 'range';
    value?: number;
    label?: string;
    typed?: {
      quantityKind: 'money' | 'percentage' | 'count' | 'date' | 'trend' | 'quantity';
      unit?: string;
      unitSource?: 'declared' | 'inferred' | 'none';
      field?: string;
      measuredAt?: string;
      appliesTo?: string;
      obsStatus?: string;
    };
    publishedAt?: string;
    url?: string;
    title?: string;
    snippet?: string;
    evidenceScore?: number;
    obsStatus?: string;
    measuredAt?: string;
    appliesTo?: string;
    unit?: string;
    quantityKind?: string;
  }>;
};

type SpecFile = {
  n: number;
  cases: SpecCase[];
};

const spec = JSON.parse(readFileSync(vectorPath, 'utf8')) as SpecFile;

function typedSourcesFromSpec(c: SpecCase) {
  return c.sources
    .filter((s) => s.typed && typeof s.value === 'number')
    .map((s) =>
      withTypedObservation(
        {
          id: s.id ?? 'src',
          kind: s.kind ?? 'numeric',
          value: s.value,
          label: s.label,
        },
        s.typed!
      )
    );
}

describe('D5 forecast-realism goldens (typed observations)', () => {
  it('SPEC vector declares N=8 cases', () => {
    expect(spec.n).toBe(8);
    expect(spec.cases).toHaveLength(8);
    expect(spec.cases.map((c) => c.id)).toEqual([
      'FR01',
      'FR02',
      'FR03',
      'FR04',
      'FR05',
      'FR06',
      'FR07',
      'FR08',
    ]);
  });

  it('case-bank additive fixtures exist for all eight ids (frozen baseline untouched)', () => {
    const manifestPath = join(fixtureDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      // Public export excludes uvrn-case-bank; SPEC vector above is the public golden source.
      return;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      n: number;
      caseIds: string[];
    };
    expect(manifest.n).toBe(8);
    for (const id of manifest.caseIds) {
      const fixture = JSON.parse(
        readFileSync(join(fixtureDir, `${id}.json`), 'utf8')
      ) as { id: string; sources: Array<{ value?: number; title?: string }> };
      expect(fixture.id).toBe(id);
      expect(fixture.sources.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('FR01 near-agree money short-horizon runs on typed path without threshold retune', () => {
    const c = spec.cases.find((x) => x.id === 'FR01')!;
    const sources = typedSourcesFromSpec(c);
    expect(sources).toHaveLength(2);
    expect(sources[0].attributes?.unitSource).toBe('declared');
    expect(sources[0].attributes?.obsStatus).toBe('F');
    expect(sources[0].attributes?.appliesTo).toBe('2026-08-08T00:00:00.000Z');

    const agree = agreeMeasurement.evaluate({ claim: c.claim, sources });
    // Default threshold 0.9 — near values may or may not agree; must be a real verdict.
    expect(['agree', 'no-agreement', 'insufficient-data']).toContain(agree.verdict);
    expect(agree.explanation).not.toMatch(/99999/);
  });

  it('FR02 messy percentage short-horizon preserves typed % axes at default thresholds', () => {
    const c = spec.cases.find((x) => x.id === 'FR02')!;
    const sources = typedSourcesFromSpec(c);
    expect(sources[0].attributes?.quantityKind).toBe('percentage');
    expect(sources[0].attributes?.unit).toBe('%');

    const agree = agreeMeasurement.evaluate({ claim: c.claim, sources });
    const disagree = disagreeMeasurement.evaluate({ claim: c.claim, sources });
    expect(agree.verdict).not.toBe('agree');
    expect(['disagree', 'none', 'insufficient-data']).toContain(disagree.verdict);
  });

  it('FR03 tempting title numbers never attach as typed values', () => {
    const c = spec.cases.find((x) => x.id === 'FR03')!;
    const sources = typedSourcesFromSpec(c);
    expect(sources.map((s) => s.value)).toEqual([158, 161]);
    for (const s of sources) {
      expect(s.value).not.toBe(999999);
      expect(s.value).not.toBe(88888);
      expect(s.attributes?.unitSource).toBe('declared');
    }
    const agree = agreeMeasurement.evaluate({ claim: c.claim, sources });
    expect(['agree', 'no-agreement', 'insufficient-data']).toContain(agree.verdict);
  });

  it('FR04 cross-dimension axes stay distinct on attributes', () => {
    const c = spec.cases.find((x) => x.id === 'FR04')!;
    const sources = typedSourcesFromSpec(c);
    expect(sources[0].attributes?.quantityKind).toBe('money');
    expect(sources[1].attributes?.quantityKind).toBe('percentage');
    expect(sources[0].attributes?.unit).toBe('[USD]');
    expect(sources[1].attributes?.unit).toBe('%');
  });

  it('FR05 three-date honesty: measuredAt and appliesTo preserved separately', () => {
    const c = spec.cases.find((x) => x.id === 'FR05')!;
    const sources = typedSourcesFromSpec(c);
    expect(sources[0].attributes?.measuredAt).toBe('2026-08-01T18:00:00.000Z');
    expect(sources[0].attributes?.appliesTo).toBe('2026-08-06T00:00:00.000Z');
    expect(sources[0].attributes?.measuredAt).not.toBe(
      sources[0].attributes?.appliesTo
    );
    expect(c.sources[0].publishedAt).toBe('2026-07-30T12:00:00.000Z');
    expect(c.sources[0].publishedAt).not.toBe(sources[0].attributes?.measuredAt);
  });

  it('FR06 provisional vs final obsStatus preserved on typed attributes', () => {
    const c = spec.cases.find((x) => x.id === 'FR06')!;
    const sources = typedSourcesFromSpec(c);
    expect(sources[0].attributes?.obsStatus).toBe('P');
    expect(sources[1].attributes?.obsStatus).toBe('A');
  });
});
