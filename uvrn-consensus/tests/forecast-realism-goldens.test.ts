/**
 * D5 golden / forecast realism — consensus honesty for messy short-horizon cases.
 * Scrape-off default; future F excluded from observation pool; no threshold retune.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  DEFAULT_SOURCE_WEIGHTS,
  extractProminenceValue,
  extractRankedSourcesWithHonesty,
} from '../src';
import type { FarmResult, FarmSource } from '../src';

const here = dirname(__filename);
const fixtureDir = join(
  here,
  '../../uvrn-case-bank/fixtures/forecast-realism'
);
const caseBankAvailable = existsSync(join(fixtureDir, 'manifest.json'));

type BankCase = {
  id: string;
  claim: string;
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
    publishedAt?: string;
    credibility?: number;
    evidenceScore?: number;
    value?: number;
    unit?: string;
    quantityKind?: string;
    measuredAt?: string;
    appliesTo?: string;
    obsStatus?: string;
  }>;
};

function loadCase(id: string): BankCase {
  return JSON.parse(
    readFileSync(join(fixtureDir, `${id}.json`), 'utf8')
  ) as BankCase;
}

function toFarm(c: BankCase, fetchedAt = '2026-08-06T00:00:00.000Z'): FarmResult {
  const sources: FarmSource[] = c.sources.map((s) => ({
    url: s.url,
    title: s.title,
    snippet: s.snippet,
    publishedAt: s.publishedAt,
    credibility: s.credibility,
    evidenceScore: s.evidenceScore ?? s.value,
    unit: s.unit,
    quantityKind: s.quantityKind as FarmSource['quantityKind'],
    measuredAt: s.measuredAt,
    appliesTo: typeof s.appliesTo === 'string' ? s.appliesTo : undefined,
    obsStatus: s.obsStatus,
  }));
  return {
    claimId: c.id,
    fetchedAt,
    durationMs: 0,
    sources,
  };
}

(caseBankAvailable ? describe : describe.skip)('D5 forecast-realism goldens (consensus scrape-off / F-gate)', () => {
  it('loads eight additive bank fixtures', () => {
    const manifest = JSON.parse(
      readFileSync(join(fixtureDir, 'manifest.json'), 'utf8')
    ) as { n: number; caseIds: string[] };
    expect(manifest.n).toBe(8);
    expect(manifest.caseIds).toHaveLength(8);
  });

  it('FR03 tempting title numbers are unused under scrape-off', () => {
    const c = loadCase('FR03');
    for (const s of c.sources) {
      const prominence = extractProminenceValue({
        url: s.url,
        title: s.title,
        snippet: s.snippet,
        // omit evidenceScore to prove title scrape stays off
      });
      expect(prominence).toEqual({ value: null, valueSource: 'none' });
      expect(prominence.value).not.toBe(999999);
      expect(prominence.value).not.toBe(88888);
    }
    // With declared evidenceScore, value is declared — still not the title scream.
    const declared = extractProminenceValue({
      url: c.sources[0].url,
      title: c.sources[0].title,
      snippet: c.sources[0].snippet,
      evidenceScore: c.sources[0].evidenceScore,
    });
    expect(declared).toEqual({ value: 158, valueSource: 'declared' });
  });

  it('FR07 future F forecast excluded from observation pool', () => {
    const c = loadCase('FR07');
    const evalMs = Date.parse('2026-08-06T00:00:00.000Z');
    const result = extractRankedSourcesWithHonesty(
      toFarm(c),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' },
      'prominence',
      false,
      evalMs
    );
    expect(result.excludedForecastCount).toBe(1);
    expect(result.observationSourceCount).toBe(1);
    // Tempting 9.99 from title must not appear as a ranked metric value.
    for (const r of result.ranked) {
      expect(r.metricValue).not.toBe(9.99);
    }
  });

  it('FR08 scrape-off does not invent unit or value from scream headline', () => {
    const c = loadCase('FR08');
    const missingUnit = c.sources[0];
    const prominence = extractProminenceValue({
      url: missingUnit.url,
      title: missingUnit.title,
      snippet: missingUnit.snippet,
    });
    expect(prominence.valueSource).toBe('none');
    expect(prominence.value).not.toBe(9999);

    // Fixtures keep host unit on B and omit unit on A — scrape must not invent either.
    expect(c.sources[0].unit).toBeUndefined();
    expect(c.sources[1].unit).toBe('[USD]');

    const evalMs = Date.parse('2026-08-06T00:00:00.000Z');
    const result = extractRankedSourcesWithHonesty(
      toFarm(c),
      DEFAULT_SOURCE_WEIGHTS,
      { mode: 'off' },
      'prominence',
      false,
      evalMs
    );
    // Both rows are future-period F → excluded from observation pool (SPEC §6.1).
    expect(result.excludedForecastCount).toBe(2);
    expect(result.observationSourceCount).toBe(0);
    for (const r of result.ranked) {
      expect(r.metricValue).not.toBe(9999);
    }
  });

  it('FR01–FR06 host-declared evidenceScore stays declared under scrape-off', () => {
    for (const id of ['FR01', 'FR02', 'FR03', 'FR04', 'FR05', 'FR06'] as const) {
      const c = loadCase(id);
      for (const s of c.sources) {
        const result = extractProminenceValue({
          url: s.url,
          title: s.title,
          snippet: s.snippet,
          evidenceScore: s.evidenceScore,
        });
        expect(result.valueSource).toBe('declared');
        expect(result.value).toBe(s.evidenceScore);
      }
    }
  });
});
