/**
 * D3 spread → driver facts — factual anchors only; no opportunity score.
 */

import { reportSpread, spreadToDriverFacts } from '../src';
import type { SpreadSourceInput } from '../src';

describe('spreadToDriverFacts (D3)', () => {
  it('emits incomplete fact when axis withheld', () => {
    const sources: SpreadSourceInput[] = [
      {
        id: 'a',
        metricValue: 10,
        originId: 'o1',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
    ];
    const readout = reportSpread(sources);
    expect(readout.incomplete).toBe(true);
    const facts = spreadToDriverFacts(readout);
    expect(facts).toHaveLength(1);
    expect(facts[0].id).toBe('spread.incomplete');
    expect(facts[0].fact).toMatch(/can't yet say how far demand and supply/i);
    expect(facts[0].fact).not.toMatch(/buy now|guaranteed/i);
    expect(facts[0].counterfactual).toMatch(/not as market advice/);
  });

  it('emits magnitude+sign fact when complete', () => {
    const sources: SpreadSourceInput[] = [
      {
        id: 'demand-1',
        metricValue: 100,
        originId: 'd1',
        role: { provenance: 'declared', evidenceClass: 'attention' },
      },
      {
        id: 'supply-1',
        metricValue: 40,
        originId: 's1',
        role: { provenance: 'declared', evidenceClass: 'supply_entry' },
      },
    ];
    const readout = reportSpread(sources);
    expect(readout.incomplete).toBe(false);
    expect(readout.magnitude).not.toBeNull();
    const facts = spreadToDriverFacts(readout);
    expect(facts[0].id).toBe('spread.divergence');
    expect(facts[0].fact).toMatch(/sit apart by about/);
    expect(facts[0].fact).not.toMatch(/buy now|guaranteed|act now/i);
  });
});
