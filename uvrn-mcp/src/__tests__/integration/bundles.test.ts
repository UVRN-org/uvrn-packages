import { handleRunEngine } from '../../tools/handlers';
import { createDivergentBundle, createTestBundle } from '../fixtures/bundles';

describe('Sample Bundle Processing', () => {
  it('should process revenue bundle from examples', async () => {
    const bundle = createTestBundle({
      bundleId: 'revenue-q1-2024',
      claim: 'Q1 revenue is $1.2M',
    });

    const result = await handleRunEngine({ bundle });
    expect(result.success).toBe(true);
    expect(result.receipt.outcome).toBe('consensus');
  });

  it('should handle divergent data correctly', async () => {
    const bundle = createDivergentBundle({
      bundleId: 'revenue-q1-2024-divergent',
      claim: 'Q1 revenue is $1.0M',
    });

    const result = await handleRunEngine({ bundle });
    expect(result.success).toBe(true);
    expect(result.receipt.outcome).toBe('indeterminate');
    expect(result.receipt.rounds.length).toBeGreaterThan(0);
  });
});
