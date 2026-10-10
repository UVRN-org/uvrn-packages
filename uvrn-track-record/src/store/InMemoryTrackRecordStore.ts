import type {
  ForecastLogEntry,
  ForecastResolution,
  MultiForecastResolution,
  OriginTrackRecord,
  RevisionEvent,
  StoredForecastResolution,
  TrackRecordStore,
  TranscriptionSample,
} from '../types';
import {
  applyForecastLogEntry,
  applyForecastResolution,
  applyMultiForecastResolution,
  applyRevisionEvent,
  applyTranscriptionSample,
  canResolveForecast,
  compareByTimeThenId,
  deriveLearnedCredibility,
  emptyTrackRecord,
  validateForecastLogEntry,
} from '../scoring';

const DEFAULT_LIST_LIMIT = 1000;
const MAX_LIST_LIMIT = 10000;

function capList(limit: number): number {
  return Math.min(Math.max(1, limit), MAX_LIST_LIMIT);
}

/**
 * Default zero-dependency TrackRecordStore backed by Maps.
 * Offline / zero-signup path (program wall 3).
 */
export class InMemoryTrackRecordStore implements TrackRecordStore {
  readonly #records = new Map<string, OriginTrackRecord>();
  readonly #transcriptionIds = new Set<string>();
  readonly #revisionIds = new Set<string>();
  readonly #forecastIds = new Set<string>();
  readonly #multiForecastIds = new Set<string>();
  readonly #logIds = new Set<string>();
  readonly #resolutions = new Map<string, StoredForecastResolution[]>();
  readonly #log = new Map<string, ForecastLogEntry[]>();

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
    this.#pushResolution(resolution);
    const current = this.#records.get(resolution.originId) ?? emptyTrackRecord(resolution.originId);
    this.#records.set(resolution.originId, applyForecastResolution(current, resolution));
  }

  async getLearnedCredibility(originId: string): Promise<number | null> {
    const row = this.#records.get(originId);
    return row ? deriveLearnedCredibility(row) : null;
  }

  async logForecast(entry: ForecastLogEntry): Promise<void> {
    const problem = validateForecastLogEntry(entry);
    if (problem) throw new Error(`invalid forecast log entry: ${problem}`);
    const key = `${entry.originId}::${entry.forecastId}`;
    if (this.#logIds.has(key)) return;
    this.#logIds.add(key);
    const rows = this.#log.get(entry.originId) ?? [];
    rows.push(structuredClone(entry));
    this.#log.set(entry.originId, rows);
    const current = this.#records.get(entry.originId) ?? emptyTrackRecord(entry.originId);
    this.#records.set(entry.originId, applyForecastLogEntry(current, entry));
  }

  async listForecastLog(originId: string, limit = DEFAULT_LIST_LIMIT): Promise<ForecastLogEntry[]> {
    return [...(this.#log.get(originId) ?? [])]
      .sort((a, b) => compareByTimeThenId(a.loggedAt, a.forecastId, b.loggedAt, b.forecastId))
      .slice(0, capList(limit))
      .map((e) => structuredClone(e));
  }

  async addMultiForecastResolution(resolution: MultiForecastResolution): Promise<void> {
    if (!canResolveForecast(resolution.appliesToEnd, resolution.resolvedAt)) {
      throw new Error(
        `forecast unresolved: resolvedAt (${resolution.resolvedAt}) is before appliesToEnd (${resolution.appliesToEnd})`
      );
    }
    const key = `${resolution.originId}::${resolution.forecastId}`;
    if (this.#multiForecastIds.has(key)) return;
    this.#multiForecastIds.add(key);
    this.#pushResolution(resolution);
    const current = this.#records.get(resolution.originId) ?? emptyTrackRecord(resolution.originId);
    this.#records.set(resolution.originId, applyMultiForecastResolution(current, resolution));
  }

  async listForecastResolutions(
    originId: string,
    limit = DEFAULT_LIST_LIMIT
  ): Promise<StoredForecastResolution[]> {
    return [...(this.#resolutions.get(originId) ?? [])]
      .sort((a, b) => compareByTimeThenId(a.resolvedAt, a.forecastId, b.resolvedAt, b.forecastId))
      .slice(0, capList(limit))
      .map((r) => structuredClone(r));
  }

  #pushResolution(resolution: StoredForecastResolution): void {
    const rows = this.#resolutions.get(resolution.originId) ?? [];
    rows.push(structuredClone(resolution));
    this.#resolutions.set(resolution.originId, rows);
  }
}
