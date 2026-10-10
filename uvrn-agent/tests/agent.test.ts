// ─────────────────────────────────────────────────────────────
// @uvrn/agent — tests
// ─────────────────────────────────────────────────────────────

import { Agent, MockFarmConnector, ConsoleEmitter, InMemoryAgentStateStore, PROFILES, Scheduler } from '../src/index';
import type {
  AgentStateStore,
  ClaimRegistration,
  PersistedAgentState,
  ReceiptEmitter,
} from '../src/types/index';
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
    agent.stop();

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
    agent.stop();

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
    agent.stop();

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
    agent.stop();

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

describe('Scheduler shutdown', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('Scheduler.stop() clears all pending timers', () => {
    jest.useFakeTimers();

    const scheduler = new Scheduler(async () => {});
    scheduler.register('claim_a', 60_000);
    scheduler.register('claim_b', 60_000);

    expect(jest.getTimerCount()).toBe(2);
    scheduler.stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('Agent.stop() leaves no pending timers', () => {
    jest.useFakeTimers();

    const agent = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new CapturingEmitter(),
    });

    agent
      .register(makeClaim({ id: 'claim_a' }))
      .register(makeClaim({ id: 'claim_b' }))
      .start();

    expect(jest.getTimerCount()).toBeGreaterThan(0);
    agent.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});

class RecordingStateStore implements AgentStateStore {
  saves: Array<{ agentId: string; state: PersistedAgentState }> = [];
  private states = new Map<string, PersistedAgentState>();

  async loadState(agentId: string): Promise<PersistedAgentState | null> {
    const state = this.states.get(agentId);
    return state ? structuredClone(state) : null;
  }

  async saveState(agentId: string, state: PersistedAgentState): Promise<void> {
    this.saves.push({ agentId, state: structuredClone(state) });
    this.states.set(agentId, structuredClone(state));
  }
}

describe('AgentStateStore', () => {
  it('round-trips state through an injected store', async () => {
    const store = new RecordingStateStore();
    const agent = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new CapturingEmitter(),
      stateStore:     store,
      agentId:        'agent_roundtrip',
    });

    agent.register(makeClaim());
    await agent.runNow('test_claim_001');

    expect(store.saves.length).toBeGreaterThan(0);
    expect(store.saves[store.saves.length - 1].agentId).toBe('agent_roundtrip');

    const persisted = await store.loadState('agent_roundtrip');
    expect(persisted).not.toBeNull();
    expect(persisted!.totalRuns).toBe(1);
    expect(persisted!.claims['test_claim_001']).toMatchObject({
      receiptSequence:  1,
      consecutiveFails: 0,
    });
    expect(persisted!.claims['test_claim_001'].lastSnapshot).not.toBeNull();
    expect(persisted!.claims['test_claim_001'].registration.id).toBe('test_claim_001');
  });

  it('persists failure counts after a failed run', async () => {
    const farm = new MockFarmConnector();
    farm.setScenario('test_claim_001', { sources: [], shouldFail: true });

    const store = new RecordingStateStore();
    const agent = new Agent({
      farmConnector:  farm,
      receiptEmitter: new CapturingEmitter(),
      stateStore:     store,
      agentId:        'agent_failures',
    });

    agent.register(makeClaim());
    await agent.runNow('test_claim_001');

    const persisted = await store.loadState('agent_failures');
    expect(persisted!.claims['test_claim_001'].consecutiveFails).toBe(1);
  });

  it('restores accumulated state into a new agent instance (restart simulation)', async () => {
    const store = new InMemoryAgentStateStore();

    const first = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new CapturingEmitter(),
      stateStore:     store,
      agentId:        'agent_restart',
    });

    first.register(makeClaim());
    await first.runNow('test_claim_001');
    await first.runNow('test_claim_001');
    first.stop();

    const second = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new CapturingEmitter(),
      stateStore:     store,
      agentId:        'agent_restart',
    });
    await second.restore();

    const status = second.status();
    expect(status.totalRuns).toBe(2);
    expect(status.claims).toHaveLength(1);
    expect(status.claims[0].id).toBe('test_claim_001');
    expect(status.claims[0].receiptSequence).toBe(2);
    expect(status.claims[0].vScore).not.toBeNull();

    await second.runNow('test_claim_001');
    expect(second.status().claims[0].receiptSequence).toBe(3);
  });

  it('restore() is a no-op when the store holds no state', async () => {
    const agent = new Agent({
      farmConnector:  new MockFarmConnector(),
      receiptEmitter: new CapturingEmitter(),
      stateStore:     new InMemoryAgentStateStore(),
      agentId:        'agent_empty',
    });

    await agent.restore();
    expect(agent.status().claims).toHaveLength(0);
    expect(agent.status().totalRuns).toBe(0);
  });
});
