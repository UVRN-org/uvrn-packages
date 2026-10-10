import type { CanonReceipt } from '@uvrn/canon';
import type { DriftSnapshot } from '@uvrn/drift';

import type {
  TimelineOptions,
  TimelineQueryOptions,
  TimelineResolution,
  TimelineResult,
  TimelineStore,
} from '../types';
import { buildChartData, buildSummary, bucketSnapshots } from './chart';

interface TimelineApiResponse {
  snapshots?: unknown;
  canonEvents?: unknown;
}

type FetchLikeResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type FetchLike = (url: string) => Promise<FetchLikeResponse>;

function getFetch(): FetchLike | undefined {
  const globalWithFetch = globalThis as typeof globalThis & { fetch?: FetchLike };
  return globalWithFetch.fetch;
}

function toIsoRange(options: TimelineQueryOptions): {
  from: string;
  to: string;
  resolution: TimelineResolution;
  includeCanonEvents: boolean;
} {
  const to = options.to ?? new Date().toISOString();
  const toMs = Date.parse(to);
  const from = options.from ?? new Date(toMs - 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    from: new Date(Date.parse(from)).toISOString(),
    to: new Date(toMs).toISOString(),
    resolution: options.resolution ?? 'daily',
    includeCanonEvents: options.includeCanonEvents ?? true,
  };
}

function isSnapshot(value: unknown): value is DriftSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.claimId === 'string' &&
    typeof record.scoredAt === 'string' &&
    typeof record.vScore === 'number' &&
    typeof record.status === 'string'
  );
}

function isCanonReceipt(value: unknown): value is CanonReceipt {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.claim_id === 'string' &&
    typeof record.canonized_at === 'string'
  );
}

export class MockTimelineStore implements TimelineStore {
  readonly #snapshots: DriftSnapshot[];
  readonly #canonEvents: CanonReceipt[];

  constructor(options: { snapshots?: DriftSnapshot[]; canonEvents?: CanonReceipt[] } = {}) {
    this.#snapshots = options.snapshots ?? [];
    this.#canonEvents = options.canonEvents ?? [];
  }

  async getSnapshots(claimId: string, from: number, to: number): Promise<DriftSnapshot[]> {
    return this.#snapshots.filter((snapshot) => (
      snapshot.claimId === claimId &&
      Date.parse(snapshot.scoredAt) >= from &&
      Date.parse(snapshot.scoredAt) <= to
    ));
  }

  async getCanonEvents(claimId: string, from: number, to: number): Promise<CanonReceipt[]> {
    return this.#canonEvents.filter((receipt) => (
      receipt.claim_id === claimId &&
      Date.parse(receipt.canonized_at) >= from &&
      Date.parse(receipt.canonized_at) <= to
    ));
  }
}

export class Timeline {
  readonly #store?: TimelineStore;
  readonly #apiUrl?: string;

  constructor(options: TimelineOptions) {
    if (!options.store && !options.apiUrl) {
      throw new Error('Timeline requires either a store or apiUrl.');
    }

    this.#store = options.store;
    this.#apiUrl = options.apiUrl;
  }

  async query(claimId: string, options: TimelineQueryOptions = {}): Promise<TimelineResult> {
    const resolved = toIsoRange(options);
    const fromMs = Date.parse(resolved.from);
    const toMs = Date.parse(resolved.to);

    const remotePayload = this.#store
      ? null
      : await this.#fetchTimeline(claimId, resolved.from, resolved.to);
    const snapshots = this.#store
      ? await this.#store.getSnapshots(claimId, fromMs, toMs)
      : this.#parseSnapshots(remotePayload);
    const canonEvents = resolved.includeCanonEvents
      ? this.#store
        ? await this.#store.getCanonEvents(claimId, fromMs, toMs)
        : this.#parseCanonEvents(remotePayload)
      : [];

    const orderedSnapshots = [...snapshots].sort((left, right) => (
      Date.parse(left.scoredAt) - Date.parse(right.scoredAt)
    ));
    const orderedCanonEvents = [...canonEvents].sort((left, right) => (
      Date.parse(left.canonized_at) - Date.parse(right.canonized_at)
    ));
    const sampledSnapshots = bucketSnapshots(orderedSnapshots, resolved.resolution);

    return {
      claimId,
      from: resolved.from,
      to: resolved.to,
      resolution: resolved.resolution,
      snapshots: sampledSnapshots,
      canonEvents: orderedCanonEvents,
      summary: buildSummary(claimId, sampledSnapshots, orderedCanonEvents),
      chart: () => buildChartData(sampledSnapshots, orderedCanonEvents, resolved.resolution),
    };
  }

  #parseSnapshots(response: TimelineApiResponse | null): DriftSnapshot[] {
    return response && Array.isArray(response.snapshots)
      ? response.snapshots.filter(isSnapshot)
      : [];
  }

  #parseCanonEvents(response: TimelineApiResponse | null): CanonReceipt[] {
    return response && Array.isArray(response.canonEvents)
      ? response.canonEvents.filter(isCanonReceipt)
      : [];
  }

  async #fetchTimeline(
    claimId: string,
    from: string,
    to: string
  ): Promise<TimelineApiResponse> {
    if (!this.#apiUrl) {
      return {};
    }

    const fetchFn = getFetch();
    if (!fetchFn) {
      throw new Error('Timeline apiUrl mode requires global fetch support.');
    }

    const query = new URLSearchParams({ claimId, from, to });
    const response = await fetchFn(`${this.#apiUrl.replace(/\/$/, '')}/timeline?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Timeline API request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    return typeof payload === 'object' && payload !== null ? (payload as TimelineApiResponse) : {};
  }
}
