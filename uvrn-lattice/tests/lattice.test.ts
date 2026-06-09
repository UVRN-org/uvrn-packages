import { runDeltaEngine } from '@uvrn/core';

import {
  BUILT_IN_TEMPLATES,
  MockDomainConnector,
  TemplateRouter,
  runLattice,
} from '../src';
import { normalizeDomainSignals } from '../src/normalizer/domainNormalizer';

describe('@uvrn/lattice', () => {
  it('runs a full mock builder-radar lattice through the real delta engine', async () => {
    const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar');
    expect(template).toBeDefined();

    const receipt = await runLattice(
      'Should regional robotics builders enter municipal maintenance markets?',
      template!,
      {
        connector: new MockDomainConnector(),
        timestamp: '2026-05-25T12:00:00.000Z',
      }
    );

    expect(receipt.receiptId).toMatch(/^lattice-receipt-/);
    expect(receipt.templateRef).toBe('builder-radar');
    expect(receipt.decompositionSpec.domains).toHaveLength(4);
    expect(Object.keys(receipt.domainsMap).sort()).toEqual(['cultural', 'economic', 'legal', 'technical']);
    expect(receipt.deltaReceipt.bundleId).toMatch(/^lattice-/);
    expect(receipt.deltaReceipt.hash).toHaveLength(64);
    expect(receipt.deltaReceipt.rounds.length).toBeGreaterThan(0);
    expect(receipt.vScore).toBe(receipt.deltaReceipt.deltaFinal);
    expect(receipt.weakestDomain).toBeTruthy();
    expect(receipt.strongestDomain).toBeTruthy();
    expect(receipt.hash).toHaveLength(64);
    expect(receipt.explanation).toContain('@uvrn/core');
    expect(receipt.interpretation).toContain('Core deltaFinal');
    expect(receipt.contradictions).toEqual([]);
  });

  it('produces a reproducible receipt hash when a run timestamp is supplied', async () => {
    const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar')!;
    const run = () =>
      runLattice('Reproducibility check', template, {
        connector: new MockDomainConnector(),
        timestamp: '2026-05-25T12:00:00.000Z',
      });

    const [first, second] = await Promise.all([run(), run()]);

    // The run timestamp is threaded into the connector via ConnectorContext, so every signal
    // shares it and the receipt hash is identical across runs — no wall-clock leakage.
    expect(first.hash).toBe(second.hash);
  });

  it('routes templates into domain specs and produces comparable metrics', async () => {
    const template = BUILT_IN_TEMPLATES[0]!;
    const router = new TemplateRouter();
    const spec = router.decompose('Compare lattice domains', template);
    const connector = new MockDomainConnector();

    const firstSignals = await connector.fetch(spec.query, spec.domains[0]!);
    const secondSignals = await connector.fetch(spec.query, spec.domains[1]!);
    const first = normalizeDomainSignals(spec.domains[0]!.id, spec.domains[0]!.label, firstSignals);
    const second = normalizeDomainSignals(spec.domains[1]!.id, spec.domains[1]!.label, secondSignals);

    const firstKeys = first.dataSpec.metrics.map((metric) => metric.key).sort();
    const secondKeys = second.dataSpec.metrics.map((metric) => metric.key).sort();

    expect(firstKeys).toEqual(secondKeys);

    const receipt = runDeltaEngine({
      bundleId: 'lattice-test-bundle',
      claim: spec.query,
      dataSpecs: [first.dataSpec, second.dataSpec],
      thresholdPct: 0.1,
      maxRounds: 1,
    });

    expect(receipt.rounds[0]?.deltasByMetric).toHaveProperty('evidence_strength');
  });
});
