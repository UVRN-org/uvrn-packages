// ─────────────────────────────────────────────────────────────
// @uvrn/agent — tests
// ─────────────────────────────────────────────────────────────

import { Agent, MockFarmConnector, ConsoleEmitter, PROFILES } from '../src/index';
import type { ClaimRegistration, ReceiptEmitter } from '../src/types/index';
import type { AgentDriftReceipt, DriftThresholdEvent } from '@uvrn/drift';

function makeClaim(overrides: Partial<ClaimRegistration> = {}): ClaimRegistration {
  return {
    id:          'test_claim_001',
    label:       'Test claim',
    query:       'test query',
    driftConfig: PROFILES.slow,
    intervalMs:  999999,
    ...overrides,
  };
}

class CapturingEmitter implements ReceiptEmitter {
  receipts: AgentDriftReceipt[]   = [];
  events:   DriftThresholdEvent[][] = [];

  async emit(receipt: AgentDriftReceipt, events: DriftThresholdEvent[]): Promise<void> {
    this.receipts.push(receipt);
    this.events.push(events);
  }
}

describe('Agent lifecycle', () => {
  it('starts and stops cleanly', () => {
    const agent = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new ConsoleEmitter(),
    });
    expect(agent.status().running).toBe(false);
    agent.start();
    expect(agent.status().running).toBe(true);
    agent.stop();
    expect(agent.status().running).toBe(false);
  });

  it('registers claims before start', () => {
    const agent = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new ConsoleEmitter(),
    });
    agent.register(makeClaim());
    expect(agent.status().claims).toHaveLength(1);
    expect(agent.status().claims[0].status).toBe('idle');
  });
});

describe('Agent.runNow()', () => {
  it('runs a claim and produces a receipt', async () => {
    const emitter = new CapturingEmitter();
    const agent   = new Agent({
      farmConnector:  new MockFarmConnector(7),
      receiptEmitter: emitter,
    });

    agent.register(makeClaim());
    agent.start();
    await agent.runNow('test_claim_001');

    expect(emitter.receipts).toHaveLength(1);
    const receipt = emitter.receipts[0];
    expect(receipt.claim_id).toBe('test_claim_001');
    expect(receipt.v_score).toBeGreaterThan(0);
    expect(receipt.v_score).toBeLessThanOrEqual(100);
    expect(receipt.drift_module).toMatch('@uvrn/drift');
  });

  it('increments receipt sequence on each run', async () => {
    const emitter = new CapturingEmitter();
    const agent   = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: emitter,
    });

    agent.register(makeClaim()).start();
    await agent.runNow('test_claim_001');
    await agent.runNow('test_claim_001');
    await agent.runNow('test_claim_001');

    expect(agent.status().claims[0].receiptSequence).toBeGreaterThanOrEqual(3);
    expect(emitter.receipts.length).toBeGreaterThanOrEqual(3);
  });

  it('emits claim:scored event', async () => {
    const agent = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new CapturingEmitter(),
    });
    agent.register(makeClaim()).start();

    const scored = jest.fn();
    agent.on('claim:scored', scored);
    await agent.runNow('test_claim_001');

    expect(scored).toHaveBeenCalledTimes(1);
  });
});

describe('Agent error handling', () => {
  it('handles FARM fetch failure gracefully', async () => {
    const farm = new MockFarmConnector();
    farm.setScenario('test_claim_001', { sources: [], shouldFail: true });

    const agent = new Agent({
      farmConnector:  farm,
      receiptEmitter: new CapturingEmitter(),
    });
    agent.register(makeClaim()).start();

    const errorHandler = jest.fn();
    agent.on('claim:error', errorHandler);
    await agent.runNow('test_claim_001');

    expect(errorHandler).toHaveBeenCalledWith('test_claim_001', expect.any(Error));
    expect(agent.status().claims[0].status).toBe('error');
  });
});

describe('Multiple claims', () => {
  it('runs multiple claims independently', async () => {
    const emitter = new CapturingEmitter();
    const agent   = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: emitter,
    });

    agent
      .register(makeClaim({ id: 'claim_a', driftConfig: PROFILES.threshold_short }))
      .register(makeClaim({ id: 'claim_b', driftConfig: PROFILES.fast }))
      .register(makeClaim({ id: 'claim_c', driftConfig: PROFILES.moderate }));

    await agent.runNow('claim_a');
    await agent.runNow('claim_b');
    await agent.runNow('claim_c');

    expect(emitter.receipts).toHaveLength(3);
    const ids = emitter.receipts.map(r => r.claim_id);
    expect(ids).toContain('claim_a');
    expect(ids).toContain('claim_b');
    expect(ids).toContain('claim_c');
  });
});
