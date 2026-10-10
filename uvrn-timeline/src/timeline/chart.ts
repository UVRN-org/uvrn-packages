import type { CanonReceipt } from '@uvrn/canon';
import type { DriftSnapshot } from '@uvrn/drift';

import type { ChartData, TimelineResolution } from '../types';

function startOfWeekUtc(date: Date): Date {
  const cloned = new Date(date.toISOString());
  const day = cloned.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  cloned.setUTCDate(cloned.getUTCDate() + offset);
  cloned.setUTCHours(0, 0, 0, 0);
  return cloned;
}

function bucketLabel(snapshot: DriftSnapshot, resolution: TimelineResolution): string {
  const date = new Date(snapshot.scoredAt);
  if (resolution === 'hourly') {
    date.setUTCMinutes(0, 0, 0);
    return date.toISOString();
  }
  if (resolution === 'weekly') {
    return startOfWeekUtc(date).toISOString();
  }

  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function bucketSnapshots(
  snapshots: DriftSnapshot[],
  resolution: TimelineResolution
): DriftSnapshot[] {
  const buckets = new Map<string, DriftSnapshot>();

  for (const snapshot of snapshots) {
    const label = bucketLabel(snapshot, resolution);
    const current = buckets.get(label);

    if (!current || Date.parse(snapshot.scoredAt) >= Date.parse(current.scoredAt)) {
      buckets.set(label, snapshot);
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, snapshot]) => snapshot);
}

function markerIndex(labels: string[], timestamp: string): number | null {
  if (labels.length === 0) {
    return null;
  }

  const target = Date.parse(timestamp);
  let closestIndex = 0;
  let closestDistance = Math.abs(Date.parse(labels[0]!) - target);

  for (let index = 1; index < labels.length; index += 1) {
    const distance = Math.abs(Date.parse(labels[index]!) - target);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export function buildChartData(
  snapshots: DriftSnapshot[],
  canonEvents: CanonReceipt[],
  resolution: TimelineResolution
): ChartData {
  const labels = snapshots.map((snapshot) => bucketLabel(snapshot, resolution));
  const vScores = snapshots.map((snapshot) => snapshot.vScore);
  const statuses = snapshots.map((snapshot) => snapshot.status);
  const canonMarkers = canonEvents
    .map((receipt) => {
      const index = markerIndex(labels, receipt.canonized_at);
      if (index == null) {
        return null;
      }

      return {
        index,
        label: 'Canonized',
        timestamp: receipt.canonized_at,
      };
    })
    .filter(
      (marker): marker is { index: number; label: string; timestamp: string } => marker !== null
    );

  return {
    labels,
    vScores,
    statuses,
    canonMarkers,
  };
}

export function buildSummary(
  claimId: string,
  snapshots: DriftSnapshot[],
  canonEvents: CanonReceipt[]
): string {
  if (snapshots.length === 0) {
    return `Claim ${claimId} has no timeline snapshots in the requested range.`;
  }

  const first = snapshots[0]!;
  const latest = snapshots[snapshots.length - 1]!;
  const peak = snapshots.reduce((current, snapshot) => (
    snapshot.vScore > current.vScore ? snapshot : current
  ));

  return `Claim ${claimId} had V-Score ${first.vScore} on ${first.scoredAt.slice(0, 10)}, peaked at ${peak.vScore} on ${peak.scoredAt.slice(0, 10)}, and is ${latest.status} at ${latest.vScore} as of ${latest.scoredAt.slice(0, 10)}. ${canonEvents.length} canonization event${canonEvents.length === 1 ? '' : 's'} occurred in range.`;
}
