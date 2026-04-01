// ─────────────────────────────────────────────────────────────
// @uvrn/agent — Agent
// ─────────────────────────────────────────────────────────────

import EventEmitter from 'events';
import { computeDriftFromInput } from '@uvrn/drift';
import { Scheduler } from './scheduler';
import { normalizeFarmResult } from './farm/normalizer';
import type {
  AgentConfig,
  AgentStatus,
  ClaimRegistration,
  ClaimState,
  ClaimAgentStatus,
} from './types/index';
import type { DriftSnapshot } from '@uvrn/drift';

const AGENT_VERSION = '0.1.0';
const AGENT_ID      = `@uvrn/agent@${AGENT_VERSION}`;

export class Agent extends EventEmitter {
  private config:    AgentConfig;
  private claims:    Map<string, ClaimState> = new Map();
  private scheduler: Scheduler;
  private running  = false;
  private startedAt: string | null = null;
  private totalRuns = 0;

  constructor(config: AgentConfig) {
    super();
    this.config    = {
      concurrency:          3,
      maxConsecutiveFails:  5,
      jitterMs:             2000,
      agentId:              AGENT_ID,
      ...config,
    };
    this.scheduler = new Scheduler(
      (claimId) => this.runClaim(claimId),
      this.config.jitterMs
    );
  }

  register(registration: ClaimRegistration): this {
    const state: ClaimState = {
      registration,
      lastSnapshot:    null,
      lastVerifiedAt:  null,
      receiptSequence: 0,
      consecutiveFails: 0,
      status:          'idle',
    };

    this.claims.set(registration.id, state);
    this.emit('claim:registered', registration);

    if (this.running) {
      this.scheduler.register(registration.id, registration.intervalMs);
    }

    return this;
  }

  unregister(claimId: string): this {
    this.scheduler.unregister(claimId);
    this.claims.delete(claimId);
    return this;
  }

  start(): this {
    if (this.running) return this;

    this.running   = true;
    this.startedAt = new Date().toISOString();
    this.emit('agent:started');

    for (const [id, state] of this.claims) {
      this.scheduler.register(id, state.registration.intervalMs);
    }

    return this;
  }

  stop(): this {
    if (!this.running) return this;

    this.scheduler.stopAll();
    this.running = false;
    this.emit('agent:stopped');

    return this;
  }

  status(): AgentStatus {
    return {
      running:   this.running,
      startedAt: this.startedAt,
      totalRuns: this.totalRuns,
      claims: Array.from(this.claims.values()).map(s => ({
        id:              s.registration.id,
        label:           s.registration.label,
        status:          s.status,
        vScore:          s.lastSnapshot?.vScore ?? null,
        lastVerifiedAt:  s.lastVerifiedAt,
        nextRunIn:       this.scheduler.nextRunIn(s.registration.id),
        receiptSequence: s.receiptSequence,
      })),
    };
  }

  async runNow(claimId: string): Promise<void> {
    await this.runClaim(claimId);
  }

  private async runClaim(claimId: string): Promise<void> {
    const state = this.claims.get(claimId);
    if (!state) return;

    this.emit('claim:started', claimId);
    state.status = 'running';
    this.totalRuns++;

    try {
      const farmResult = await this.config.farmConnector.fetch(state.registration);
      const components = normalizeFarmResult(farmResult);
      const receiptId = `${claimId}_r${state.receiptSequence + 1}`;

      const driftResult = computeDriftFromInput({
        receiptId,
        claimId,
        originalScore:    state.lastSnapshot?.vScore ?? 100,
        components,
        verifiedAt:       farmResult.fetchedAt,
        config:           state.registration.driftConfig,
        previousSnapshot: state.lastSnapshot ?? undefined,
      });

      state.lastSnapshot    = driftResult.snapshot;
      state.lastVerifiedAt  = farmResult.fetchedAt;
      state.receiptSequence++;
      state.consecutiveFails = 0;
      state.status           = this.mapDriftStatus(driftResult.snapshot.status);

      for (const event of driftResult.events) {
        this.emit('claim:threshold', event);
      }

      this.emit('claim:scored', driftResult.snapshot);
      await this.config.receiptEmitter.emit(driftResult.receipt, driftResult.events);
      this.emit('receipt:emitted', driftResult.receipt);
    } catch (err) {
      state.consecutiveFails++;
      state.status = 'error';

      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('claim:error', claimId, error);

      if (state.consecutiveFails >= (this.config.maxConsecutiveFails ?? 5)) {
        console.error(
          `[uvrn/agent] ${claimId} paused after ${state.consecutiveFails} consecutive failures`
        );
        this.scheduler.unregister(claimId);
      }
    }
  }

  private mapDriftStatus(s: DriftSnapshot['status']): ClaimAgentStatus {
    return s as ClaimAgentStatus;
  }
}
