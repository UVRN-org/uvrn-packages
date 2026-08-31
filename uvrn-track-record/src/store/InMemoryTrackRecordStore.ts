import type {
  ForecastResolution,
  OriginTrackRecord,
  RevisionEvent,
  TrackRecordStore,
  TranscriptionSample,
} from '../types';
import {
  applyForecastResolution,
  applyRevisionEvent,
  applyTranscriptionSample,
  canResolveForecast,
  deriveLearnedCredibility,
  emptyTrackRecord,
} from '../scoring';

/**
 * Default zero-dependency TrackRecordStore backed by Maps.
 * Offline / zero-signup path (program wall 3).
 */
export class InMemoryTrackRecordStore implements TrackRecordStore {
  readonly #records = new Map<string, OriginTrackRecord>();
  readonly #transcriptionIds = new Set<string>();
  readonly #revisionIds = new Set<string>();
  readonly #forecastIds = new Set<string>();

  async getRecord(originId: string): Promise<OriginTrackRecord | null> {
    const row = this.#records.get(originId);
    return row ? structuredClone(row) : null;
  }

  async putRecord(record: OriginTrackRecord): Promise<void> {
    this.#records.set(record.originId, structuredClone(record));
  }

  async listRecords(limit = 100): Promise<OriginTrackRecord[]> {
    const capped = Math.min(Math.max(1, limit), 500);
    return [...this.#records.values()]
      .sort((a, b) => a.originId.localeCompare(b.originId))
      .slice(0, capped)
      .map((r) => structuredClone(r));
  }

  async addTranscription(sample: TranscriptionSample): Promise<void> {
    const key = `${sample.originId}::${sample.sampleId}`;
    if (this.#transcriptionIds.has(key)) return;
    this.#transcriptionIds.add(key);
    const current = this.#records.get(sample.originId) ?? emptyTrackRecord(sample.originId);
    this.#records.set(sample.originId, applyTranscriptionSample(current, sample));
  }

  async addRevision(event: RevisionEvent): Promise<void> {
    const key = `${event.originId}::${event.revisionId}`;
    if (this.#revisionIds.has(key)) return;
    this.#revisionIds.add(key);
    const current = this.#records.get(event.originId) ?? emptyTrackRecord(event.originId);
    this.#records.set(event.originId, applyRevisionEvent(current, event));
  }

  async addForecastResolution(resolution: ForecastResolution): Promise<void> {
    if (!canResolveForecast(resolution.appliesToEnd, resolution.resolvedAt)) {
      throw new Error(
        `forecast unresolved: resolvedAt (${resolution.resolvedAt}) is before appliesToEnd (${resolution.appliesToEnd})`
      );
    }
    const key = `${resolution.originId}::${resolution.forecastId}`;
    if (this.#forecastIds.has(key)) return;
    this.#forecastIds.add(key);
    const current = this.#records.get(resolution.originId) ?? emptyTrackRecord(resolution.originId);
    this.#records.set(resolution.originId, applyForecastResolution(current, resolution));
  }

  async getLearnedCredibility(originId: string): Promise<number | null> {
    const row = this.#records.get(originId);
    return row ? deriveLearnedCredibility(row) : null;
  }
}
