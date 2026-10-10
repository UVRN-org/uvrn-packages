import type { HistoryEvent, HistoryReadResult, HistoryReader, ScanScope } from './types';

/**
 * In-memory HistoryReader for tests and MCP host-injected batches.
 * Does not invent a cross-claim index — filters the provided event list by window/subjectRefs.
 */
export class InMemoryHistoryReader implements HistoryReader {
  readonly #events: HistoryEvent[];

  constructor(events: HistoryEvent[] = []) {
    this.#events = events.slice();
  }

  async readBatch(scope: ScanScope): Promise<HistoryReadResult> {
    const fromMs = Date.parse(scope.window.from);
    const toMs = Date.parse(scope.window.to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      return {
        ok: false,
        reason: 'measured-gap',
        message:
          'History window is not a usable ISO range for batch read (from/to parse failed or from>to). Existing store APIs cannot answer this scoped scan without a clearer window — escalate; do not invent a cross-claim index.',
      };
    }

    const allow = scope.subjectRefs?.length
      ? new Set(scope.subjectRefs)
      : null;

    const events = this.#events.filter((e) => {
      const t = Date.parse(e.observedAt);
      if (!Number.isFinite(t) || t < fromMs || t > toMs) return false;
      if (allow && !allow.has(e.subjectRef)) return false;
      return true;
    });

    return { ok: true, events };
  }
}

/**
 * Map track-record listRecords()-shaped rows into HistoryEvents (origin-centric).
 * Uses updatedAt as observedAt; subjectRef = originId.
 */
export function historyEventsFromTrackRecords(
  records: Array<{ originId: string; updatedAt: string }>
): HistoryEvent[] {
  return records.map((r, i) => ({
    id: `track:${r.originId}:${i}`,
    subjectRef: r.originId,
    observedAt: r.updatedAt,
    originId: r.originId,
    kind: 'track-record',
  }));
}

/**
 * Map receipt-store list()-shaped rows into HistoryEvents (claim-centric when claimId present).
 */
export function historyEventsFromStoredReceipts(
  rows: Array<{
    createdAt: string;
    receipt: { claimId?: string; claim_id?: string; receiptHash?: string };
  }>
): HistoryEvent[] {
  return rows.map((row, i) => {
    const claimId = row.receipt.claimId ?? row.receipt.claim_id;
    const subjectRef = claimId ?? row.receipt.receiptHash ?? `receipt:${i}`;
    return {
      id: `receipt:${row.receipt.receiptHash ?? i}`,
      subjectRef,
      observedAt: row.createdAt,
      claimId,
      kind: 'network-receipt',
    };
  });
}
