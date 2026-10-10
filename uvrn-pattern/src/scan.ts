import { FrequencySpikeDetector } from './detectors/frequencySpike';
import type { Detector, HistoryReader, ScanResult, ScanScope } from './types';

const HONESTY = { detectedNotVerified: true as const, receiptClass: false as const };

function refuse(reason: string): ScanResult {
  return { status: 'refused', reason, observations: [], honesty: HONESTY };
}

/**
 * Run one detector over a scoped HistoryReader batch.
 * joinScope is required; unbound scans are refused.
 */
export async function scanPatterns(
  reader: HistoryReader,
  scope: ScanScope,
  detector: Detector = new FrequencySpikeDetector()
): Promise<ScanResult> {
  if (typeof scope?.joinScope !== 'string' || scope.joinScope.trim().length === 0) {
    return refuse(
      'joinScope is required — refuse unbound / silent global pattern scans (privacy + honesty wall).'
    );
  }
  if (
    !scope.window ||
    typeof scope.window.from !== 'string' ||
    typeof scope.window.to !== 'string' ||
    scope.window.from.trim().length === 0 ||
    scope.window.to.trim().length === 0
  ) {
    return refuse('window.from and window.to (ISO) are required for a scoped scan.');
  }

  let read;
  try {
    read = await reader.readBatch({
      joinScope: scope.joinScope.trim(),
      window: scope.window,
      ...(scope.subjectRefs !== undefined ? { subjectRefs: scope.subjectRefs } : {}),
    });
  } catch (err) {
    return {
      status: 'measured-gap',
      escalate: true,
      message: `HistoryReader threw during scoped batch read: ${
        err instanceof Error ? err.message : String(err)
      }. Load-bearing store-API bet failed for this host — escalate; expand-later cross-claim index may become required. Do not invent a second ledger or rewrite receipt-4.`,
      observations: [],
      honesty: HONESTY,
    };
  }

  if (!read.ok) {
    return {
      status: 'measured-gap',
      escalate: true,
      message: read.message,
      observations: [],
      honesty: HONESTY,
    };
  }

  if (read.events.length === 0) {
    return {
      status: 'insufficient',
      reason:
        'Empty history in scope/window — honest insufficient signal (success when disclosed). No pattern verified.',
      observations: [],
      honesty: HONESTY,
    };
  }

  const observations = detector.detect(read.events, {
    joinScope: scope.joinScope.trim(),
    window: scope.window,
    ...(scope.subjectRefs !== undefined ? { subjectRefs: scope.subjectRefs } : {}),
  });

  if (observations.length === 0) {
    return {
      status: 'insufficient',
      reason: `History present (${read.events.length} events) but detector ${detector.id}@${detector.version} found no pattern under its threshold — not verified.`,
      observations: [],
      honesty: HONESTY,
    };
  }

  return {
    status: 'observations',
    observations,
    honesty: HONESTY,
  };
}
