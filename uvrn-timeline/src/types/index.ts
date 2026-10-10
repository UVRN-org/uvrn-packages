export type { DriftSnapshot } from '@uvrn/drift';
export type { CanonReceipt } from '@uvrn/canon';

export type TimelineResolution = 'hourly' | 'daily' | 'weekly';

export interface TimelineQueryOptions {
  from?: string;
  to?: string;
  resolution?: TimelineResolution;
  includeCanonEvents?: boolean;
}

export interface ChartData {
  labels: string[];
  vScores: number[];
  statuses: string[];
  canonMarkers: Array<{
    index: number;
    label: string;
    timestamp: string;
  }>;
}

export interface TimelineResult {
  claimId: string;
  from: string;
  to: string;
  resolution: TimelineResolution;
  snapshots: import('@uvrn/drift').DriftSnapshot[];
  canonEvents: import('@uvrn/canon').CanonReceipt[];
  summary: string;
  chart(): ChartData;
}

export interface TimelineStore {
  getSnapshots(
    claimId: string,
    from: number,
    to: number
  ): Promise<import('@uvrn/drift').DriftSnapshot[]>;
  getCanonEvents(
    claimId: string,
    from: number,
    to: number
  ): Promise<import('@uvrn/canon').CanonReceipt[]>;
}

export interface TimelineOptions {
  store?: TimelineStore;
  apiUrl?: string;
}
