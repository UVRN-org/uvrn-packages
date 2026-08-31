import {
  calculateClassPartitionedAgreement,
  calculateOriginAgreementScore,
  isAssumedMissingWhy,
  labelRoles,
  normalizeRoleAssignment,
  organizeByRole,
  reportSpread,
} from '../src';
import type { SpreadSourceInput } from '../src';
import * as fs from 'fs';
import * as path from 'path';

describe('BP-v2.1-Spread role label + organize', () => {
  it('labels missing role as no_role and keeps data organized', () => {
    const sources: SpreadSourceInput[] = [
      { id: 'a', metricValue: 10, originId: 'o1' },
      {
        id: 'b',
        metricValue: 20,
        originId: 'o2',
        role: { provenance: 'unknown' },
      },
    ];
    const labeled = labelRoles(sources);
    expect(labeled[0].role?.provenance).toBe('no_role');
    expect(labeled[1].role?.provenance).toBe('unknown');

    const organized = organizeByRole(sources);
    expect(organized.noRole.map((s) => s.id)).toContain('a');
    expect(organized.unknown.map((s) => s.id)).toContain('b');
    const allIds = [
      ...Object.values(organized.byClass).flat(),
      ...organized.noRole,
      ...organized.incompleteAssumed,
      ...organized.unknown,
    ].map((s) => s.id);
    expect(new Set(allIds)).toEqual(new Set(['a', 'b']));
  });

  it('records assumed roles only with why; incomplete assumed is not noRole', () => {
    const withWhy = normalizeRoleAssignment({
      provenance: 'assumed',
      evidenceClass: 'attention',
      why: 'host adapter default for demand claim',
    });
    expect(isAssumedMissingWhy(withWhy)).toBe(false);

    const withoutWhy = normalizeRoleAssignment({
      provenance: 'assumed',
      evidenceClass: 'attention',
    });
    expect(isAssumedMissingWhy(withoutWhy)).toBe(true);

    const organized = organizeByRole([
      {
        id: 'x',
        metricValue: 1,
        originId: 'ox',
        role: { provenance: 'assumed', evidenceClass: 'attention' },
      },
    ]);
    expect(organized.byClass.attention).toHaveLength(0);
    expect(organized.incompleteAssumed.map((s) => s.id)).toContain('x');
    expect(organized.noRole).toHaveLength(0);
  });
});

describe('BP-v2.1-Spread C-2 class-partitioned agreement', () => {
  it('separates within-class disagreement from multi-class presence', () => {
    const sources: SpreadSourceInput[] = [
      {
        id: 'pinterest',
        metricValue: 100,
        originId: 'pin',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'x',
        metricValue: 10,
        originId: 'xcom',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'tiktok',
        metricValue: 50,
        originId: 'tt',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'etsy',
        metricValue: 2,
        originId: 'etsy',
        role: { provenance: 'declared', evidenceClass: 'supply_entry' },
      },
    ];

    const partitioned = calculateClassPartitionedAgreement(sources);
    expect(partitioned.multipleClassesPresent).toBe(true);
    expect(partitioned.partitions.length).toBe(2);

    const attention = partitioned.partitions.find((p) => p.evidenceClass === 'attention')!;
    expect(attention.originAgreementScore).toBeLessThan(50);
    expect(attention.distinctOriginCount).toBe(3);

    const supply = partitioned.partitions.find((p) => p.evidenceClass === 'supply_entry')!;
    expect(supply.originAgreementScore).toBe(100);

    const legacyMixed = calculateOriginAgreementScore(
      sources.map((s) => ({ metricValue: s.metricValue, originId: s.originId! }))
    );
    expect(attention.originAgreementScore).not.toBe(legacyMixed);
  });

  it('marks incomplete when no_role rows cannot stand in for declared partition math', () => {
    const result = calculateClassPartitionedAgreement([
      { id: 'raw', metricValue: 9, originId: 'o1' },
      {
        id: 'attn',
        metricValue: 11,
        originId: 'o2',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
    ]);
    expect(result.incomplete).toBe(true);
    expect(result.incompleteReasons.some((r) => /no_role/i.test(r))).toBe(true);
    expect(result.organized.noRole).toHaveLength(1);
  });
});

describe('BP-v2.1-Spread C-3 reportSpread', () => {
  it('returns magnitude and sign for demand vs supply partitions', () => {
    const sources: SpreadSourceInput[] = [
      {
        id: 'social-a',
        metricValue: 100,
        originId: 'pin',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'social-b',
        metricValue: 100,
        originId: 'xcom',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'market',
        metricValue: 10,
        originId: 'etsy',
        role: { provenance: 'declared', evidenceClass: 'supply_entry' },
      },
    ];

    const readout = reportSpread(sources);
    expect(readout.magnitude).toBeGreaterThan(0);
    expect(readout.sign).toBe(1);
    expect(readout.signedDivergence).toBe(readout.magnitude! * readout.sign!);
    expect(readout.demandRepresentative).toBe(100);
    expect(readout.supplyRepresentative).toBe(10);
    expect(readout.incomplete).toBe(false);
  });

  it('flips sign when supply exceeds demand', () => {
    const sources: SpreadSourceInput[] = [
      {
        id: 'social',
        metricValue: 5,
        originId: 'pin',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'market',
        metricValue: 50,
        originId: 'etsy',
        role: { provenance: 'declared', evidenceClass: 'supply_entry' },
      },
    ];
    const readout = reportSpread(sources);
    expect(readout.sign).toBe(-1);
    expect(readout.signedDivergence).toBeLessThan(0);
  });

  it('balanced complete axis uses 0/0 — incomplete withholds null', () => {
    const balanced = reportSpread([
      {
        id: 'a',
        metricValue: 40,
        originId: 'o1',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'b',
        metricValue: 40,
        originId: 'o2',
        role: { provenance: 'declared', evidenceClass: 'supply_entry' },
      },
    ]);
    expect(balanced.incomplete).toBe(false);
    expect(balanced.magnitude).toBe(0);
    expect(balanced.sign).toBe(0);
    expect(balanced.signedDivergence).toBe(0);

    const incomplete = reportSpread([{ id: 'only', metricValue: 42, originId: 'o1' }]);
    expect(incomplete.incomplete).toBe(true);
    expect(incomplete.magnitude).toBeNull();
    expect(incomplete.sign).toBeNull();
    expect(incomplete.signedDivergence).toBeNull();
    expect(incomplete.interpretation).toMatch(/withheld/i);
  });

  it('accepts assumed role with why for partition math', () => {
    const readout = reportSpread([
      {
        id: 'social',
        metricValue: 80,
        originId: 'pin',
        role: {
          provenance: 'assumed',
          evidenceClass: 'attention',
          why: 'adapter default for trend-heat claim',
        },
      },
      {
        id: 'market',
        metricValue: 20,
        originId: 'etsy',
        role: {
          provenance: 'assumed',
          evidenceClass: 'supply_entry',
          why: 'adapter default for listing-count claim',
        },
      },
    ]);
    expect(readout.incomplete).toBe(false);
    expect(readout.sign).toBe(1);
    expect(readout.magnitude).toBeGreaterThan(0);
  });

  it('uses honest vocabulary across readout + README + CHANGELOG', () => {
    const readout = reportSpread([
      {
        id: 'a',
        metricValue: 30,
        originId: 'o1',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'b',
        metricValue: 10,
        originId: 'o2',
        role: { provenance: 'declared', evidenceClass: 'supply_entry' },
      },
    ]);
    const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
    const changelog = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
    const text = `${readout.interpretation}\n${readme}\n${changelog}`;
    expect(text).not.toMatch(/\b(strong|guaranteed)\s+opportunity\b/i);
    expect(text).not.toMatch(/\bbuy now\b/i);
    expect(text).not.toMatch(/\bguaranteed edge\b/i);
    expect(text).not.toMatch(/\bverified trends?\b/i);
    expect(text).not.toMatch(/\bis (an )?opportunity score\b/i);
    expect(readout.interpretation).toMatch(/state only/i);
    expect(readme).toMatch(/EvidenceClass/i);
  });
});
