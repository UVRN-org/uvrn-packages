/**
 * Optional SQLite TrackRecordStore — requires peer `@uvrn/track-record`.
 * Import from `@uvrn/store-sqlite/track-record` (not the main entry).
 */

import type {
  ForecastLogEntry,
  ForecastResolution,
  MultiForecastResolution,
  OriginTrackRecord,
  RevisionEvent,
  StoredForecastResolution,
  TrackRecordStore,
  TranscriptionSample,
} from '@uvrn/track-record';
import type { UvrnDatabase } from './db';

type TrackRecordRuntime = {
  applyForecastResolution: (
    current: OriginTrackRecord,
    resolution: ForecastResolution
  ) => OriginTrackRecord;
  applyRevisionEvent: (current: OriginTrackRecord, event: RevisionEvent) => OriginTrackRecord;
  applyTranscriptionSample: (
    current: OriginTrackRecord,
    sample: TranscriptionSample
  ) => OriginTrackRecord;
  canResolveForecast: (appliesToEnd: string, resolvedAt: string) => boolean;
  deriveLearnedCredibility: (record: OriginTrackRecord) => number | null;
  emptyTrackRecord: (originId: string) => OriginTrackRecord;
  /** Absent on @uvrn/track-record releases that predate forecast logging. */
  applyForecastLogEntry?: (current: OriginTrackRecord, entry: ForecastLogEntry) => OriginTrackRecord;
  applyMultiForecastResolution?: (
    current: OriginTrackRecord,
    resolution: MultiForecastResolution
  ) => OriginTrackRecord;
  validateForecastLogEntry?: (entry: ForecastLogEntry) => string | null;
};

let trackRecordRuntime: TrackRecordRuntime | null = null;

async function loadTrackRecordRuntime(): Promise<TrackRecordRuntime> {
  if (trackRecordRuntime) return trackRecordRuntime;
  const mod = await import('@uvrn/track-record');
  const loaded: TrackRecordRuntime = {
    applyForecastResolution: mod.applyForecastResolution,
    applyRevisionEvent: mod.applyRevisionEvent,
    applyTranscriptionSample: mod.applyTranscriptionSample,
    canResolveForecast: mod.canResolveForecast,
    deriveLearnedCredibility: mod.deriveLearnedCredibility,
    emptyTrackRecord: mod.emptyTrackRecord,
    applyForecastLogEntry: mod.applyForecastLogEntry,
    applyMultiForecastResolution: mod.applyMultiForecastResolution,
    validateForecastLogEntry: mod.validateForecastLogEntry,
  };
  trackRecordRuntime = loaded;
  return loaded;
}

function requireRuntimeFn<T>(fn: T | undefined, name: string): T {
  if (!fn) {
    throw new Error(
      `@uvrn/track-record is missing ${name}; upgrade the peer to a release with forecast logging`
    );
  }
  return fn;
}

const DEFAULT_LIST_LIMIT = 1000;
const MAX_LIST_LIMIT = 10000;

function capList(limit: number): number {
  return Math.min(Math.max(1, limit), MAX_LIST_LIMIT);
}

function byTimeThenId(aTime: string, aId: string, bTime: string, bId: string): number {
  const d = Date.parse(aTime) - Date.parse(bTime);
  if (d !== 0 && !Number.isNaN(d)) return d;
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

/** SqliteTrackRecordStore persists per-origin track records (not signers). */
export class SqliteTrackRecordStore implements TrackRecordStore {
  readonly #db: UvrnDatabase;

  constructor(db: UvrnDatabase) {
    this.#db = db;
  }

  async getRecord(originId: string): Promise<OriginTrackRecord | null> {
    const row = this.#db.raw
      .prepare('SELECT json FROM track_records WHERE origin_id = ?')
      .get(originId) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as OriginTrackRecord) : null;
  }

  async putRecord(record: OriginTrackRecord): Promise<void> {
    this.#upsertRecord(record);
  }

  async listRecords(limit = 100): Promise<OriginTrackRecord[]> {
    const capped = Math.min(Math.max(1, limit), 500);
    const rows = this.#db.raw
      .prepare('SELECT json FROM track_records ORDER BY origin_id ASC LIMIT ?')
      .all(capped) as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as OriginTrackRecord);
  }

  async addTranscription(sample: TranscriptionSample): Promise<void> {
    const { applyTranscriptionSample, emptyTrackRecord } = await loadTrackRecordRuntime();
    const existing = this.#db.raw
      .prepare('SELECT sample_id FROM track_transcriptions WHERE sample_id = ?')
      .get(sample.sampleId) as { sample_id: string } | undefined;
    if (existing) return;
    this.#db.raw
      .prepare('INSERT INTO track_transcriptions (sample_id, origin_id, json) VALUES (?, ?, ?)')
      .run(sample.sampleId, sample.originId, JSON.stringify(sample));
    const current = (await this.getRecord(sample.originId)) ?? emptyTrackRecord(sample.originId);
    this.#upsertRecord(applyTranscriptionSample(current, sample));
  }

  async addRevision(event: RevisionEvent): Promise<void> {
    const { applyRevisionEvent, emptyTrackRecord } = await loadTrackRecordRuntime();
    const existing = this.#db.raw
      .prepare('SELECT revision_id FROM track_revisions WHERE revision_id = ?')
      .get(event.revisionId) as { revision_id: string } | undefined;
    if (existing) return;
    this.#db.raw
      .prepare('INSERT INTO track_revisions (revision_id, origin_id, json) VALUES (?, ?, ?)')
      .run(event.revisionId, event.originId, JSON.stringify(event));
    const current = (await this.getRecord(event.originId)) ?? emptyTrackRecord(event.originId);
    this.#upsertRecord(applyRevisionEvent(current, event));
  }

  async addForecastResolution(resolution: ForecastResolution): Promise<void> {
    const { applyForecastResolution, canResolveForecast, emptyTrackRecord } =
      await loadTrackRecordRuntime();
    if (!canResolveForecast(resolution.appliesToEnd, resolution.resolvedAt)) {
      throw new Error(
        `forecast unresolved: resolvedAt (${resolution.resolvedAt}) is before appliesToEnd (${resolution.appliesToEnd})`
      );
    }
    const existing = this.#db.raw
      .prepare('SELECT forecast_id FROM track_forecast_resolutions WHERE forecast_id = ?')
      .get(resolution.forecastId) as { forecast_id: string } | undefined;
    if (existing) return;
    this.#db.raw
      .prepare(
        'INSERT INTO track_forecast_resolutions (forecast_id, origin_id, json) VALUES (?, ?, ?)'
      )
      .run(resolution.forecastId, resolution.originId, JSON.stringify(resolution));
    const current =
      (await this.getRecord(resolution.originId)) ?? emptyTrackRecord(resolution.originId);
    this.#upsertRecord(applyForecastResolution(current, resolution));
  }

  async getLearnedCredibility(originId: string): Promise<number | null> {
    const { deriveLearnedCredibility } = await loadTrackRecordRuntime();
    const row = await this.getRecord(originId);
    return row ? deriveLearnedCredibility(row) : null;
  }

  async logForecast(entry: ForecastLogEntry): Promise<void> {
    const runtime = await loadTrackRecordRuntime();
    const validate = requireRuntimeFn(runtime.validateForecastLogEntry, 'validateForecastLogEntry');
    const apply = requireRuntimeFn(runtime.applyForecastLogEntry, 'applyForecastLogEntry');
    const problem = validate(entry);
    if (problem) throw new Error(`invalid forecast log entry: ${problem}`);
    const existing = this.#db.raw
      .prepare('SELECT forecast_id FROM track_forecast_log WHERE forecast_id = ?')
      .get(entry.forecastId) as { forecast_id: string } | undefined;
    if (existing) return;
    this.#db.raw
      .prepare('INSERT INTO track_forecast_log (forecast_id, origin_id, json) VALUES (?, ?, ?)')
      .run(entry.forecastId, entry.originId, JSON.stringify(entry));
    const current = (await this.getRecord(entry.originId)) ?? runtime.emptyTrackRecord(entry.originId);
    this.#upsertRecord(apply(current, entry));
  }

  async listForecastLog(originId: string, limit = DEFAULT_LIST_LIMIT): Promise<ForecastLogEntry[]> {
    const rows = this.#db.raw
      .prepare('SELECT json FROM track_forecast_log WHERE origin_id = ?')
      .all(originId) as Array<{ json: string }>;
    return rows
      .map((row) => JSON.parse(row.json) as ForecastLogEntry)
      .sort((a, b) => byTimeThenId(a.loggedAt, a.forecastId, b.loggedAt, b.forecastId))
      .slice(0, capList(limit));
  }

  async addMultiForecastResolution(resolution: MultiForecastResolution): Promise<void> {
    const runtime = await loadTrackRecordRuntime();
    const apply = requireRuntimeFn(
      runtime.applyMultiForecastResolution,
      'applyMultiForecastResolution'
    );
    if (!runtime.canResolveForecast(resolution.appliesToEnd, resolution.resolvedAt)) {
      throw new Error(
        `forecast unresolved: resolvedAt (${resolution.resolvedAt}) is before appliesToEnd (${resolution.appliesToEnd})`
      );
    }
    const existing = this.#db.raw
      .prepare('SELECT forecast_id FROM track_forecast_resolutions_multi WHERE forecast_id = ?')
      .get(resolution.forecastId) as { forecast_id: string } | undefined;
    if (existing) return;
    this.#db.raw
      .prepare(
        'INSERT INTO track_forecast_resolutions_multi (forecast_id, origin_id, json) VALUES (?, ?, ?)'
      )
      .run(resolution.forecastId, resolution.originId, JSON.stringify(resolution));
    const current =
      (await this.getRecord(resolution.originId)) ?? runtime.emptyTrackRecord(resolution.originId);
    this.#upsertRecord(apply(current, resolution));
  }

  async listForecastResolutions(
    originId: string,
    limit = DEFAULT_LIST_LIMIT
  ): Promise<StoredForecastResolution[]> {
    const binary = this.#db.raw
      .prepare('SELECT json FROM track_forecast_resolutions WHERE origin_id = ?')
      .all(originId) as Array<{ json: string }>;
    const multi = this.#db.raw
      .prepare('SELECT json FROM track_forecast_resolutions_multi WHERE origin_id = ?')
      .all(originId) as Array<{ json: string }>;
    return [...binary, ...multi]
      .map((row) => JSON.parse(row.json) as StoredForecastResolution)
      .sort((a, b) => byTimeThenId(a.resolvedAt, a.forecastId, b.resolvedAt, b.forecastId))
      .slice(0, capList(limit));
  }

  #upsertRecord(record: OriginTrackRecord): void {
    this.#db.raw
      .prepare(
        'INSERT INTO track_records (origin_id, updated_at, json) VALUES (?, ?, ?) ' +
          'ON CONFLICT(origin_id) DO UPDATE SET updated_at = excluded.updated_at, json = excluded.json'
      )
      .run(record.originId, record.updatedAt, JSON.stringify(record));
  }
}
