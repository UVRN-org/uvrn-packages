// ─────────────────────────────────────────────────────────────
// @uvrn/agent — emitters
// ─────────────────────────────────────────────────────────────

import { appendFileSync } from 'fs';
import type { ReceiptEmitter } from '../types/index';
import type { AgentDriftReceipt, DriftThresholdEvent } from '@uvrn/drift';

export class ConsoleEmitter implements ReceiptEmitter {
  async emit(receipt: AgentDriftReceipt, events: DriftThresholdEvent[]): Promise<void> {
    const status = receipt.status.toUpperCase().padEnd(8);
    const score  = receipt.v_score.toFixed(1).padStart(5);
    const delta  = receipt.drift_delta >= 0
      ? `+${receipt.drift_delta.toFixed(1)}`
      : receipt.drift_delta.toFixed(1);

    console.log(
      `[uvrn/agent] ${receipt.scored_at} | ${receipt.claim_id} | ` +
      `v=${score} Δ=${delta.padStart(6)} | ${status} | ` +
      `C:${Math.round(receipt.components.completeness)} ` +
      `P:${Math.round(receipt.components.parity)} ` +
      `F:${Math.round(receipt.components.freshness)}`
    );

    for (const event of events) {
      const claimId = event.claimId ?? event.receipt_id;
      const comp = event.component ?? 'composite';
      const vScore = event.vScore ?? event.score;
      console.warn(
        `[uvrn/agent] ⚠ THRESHOLD: ${claimId} ` +
        `${event.from} → ${event.to} via ${comp} at v=${vScore.toFixed(1)}`
      );
    }
  }
}

export class FileEmitter implements ReceiptEmitter {
  constructor(private path: string) {}

  async emit(receipt: AgentDriftReceipt, events: DriftThresholdEvent[]): Promise<void> {
    const line = JSON.stringify({ receipt, events, emitted_at: new Date().toISOString() });
    appendFileSync(this.path, line + '\n', 'utf8');
  }
}

export class WebhookEmitter implements ReceiptEmitter {
  constructor(
    private url: string,
    private options: {
      onlyAlerts?: boolean;
      headers?:    Record<string, string>;
    } = {}
  ) {}

  async emit(receipt: AgentDriftReceipt, events: DriftThresholdEvent[]): Promise<void> {
    if (this.options.onlyAlerts && events.length === 0) return;

    const body = JSON.stringify({
      receipt,
      events,
      emitted_at: new Date().toISOString(),
    });

    await fetch(this.url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
      },
      body,
    });
  }
}

export class MultiEmitter implements ReceiptEmitter {
  constructor(private emitters: ReceiptEmitter[]) {}

  async emit(receipt: AgentDriftReceipt, events: DriftThresholdEvent[]): Promise<void> {
    await Promise.allSettled(
      this.emitters.map(e => e.emit(receipt, events))
    );
  }
}
