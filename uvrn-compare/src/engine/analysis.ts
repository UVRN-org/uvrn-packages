import type { CompareOptions, CompareResult, SeriesOptions, SeriesResult } from '../types';

interface ParsedReceipt {
  claimId: string;
  vScore: number;
  status: string;
  scoredAt: string;
  scoredAtMs: number;
  original: unknown;
}

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike | null {
  return typeof value === 'object' && value !== null ? (value as RecordLike) : null;
}

function getRecord(value: RecordLike, key: string): RecordLike | null {
  return asRecord(value[key]);
}

function getString(value: RecordLike, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return undefined;
}

function getNumber(value: RecordLike, keys: string[]): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeScore(score: number, enabled: boolean): number {
  const base = enabled && score >= 0 && score <= 1 ? score * 100 : score;
  return Math.min(Math.max(base, 0), 100);
}

export function parseReceipt(input: unknown, options: CompareOptions = {}): ParsedReceipt {
  const record = asRecord(input);
  if (!record) {
    throw new Error('CompareEngine expected each receipt to be an object.');
  }

  const finalSnapshot = getRecord(record, 'final_snapshot');
  const driftReceipt = getRecord(record, 'drift_receipt');
  const validation = getRecord(record, 'validation');
  const drift = getRecord(record, 'drift');

  const claimId =
    getString(record, ['claimId', 'claim_id']) ??
    (finalSnapshot ? getString(finalSnapshot, ['claimId', 'claim_id']) : undefined) ??
    (driftReceipt ? getString(driftReceipt, ['claimId', 'claim_id']) : undefined);
  const vScore =
    getNumber(record, ['vScore', 'v_score']) ??
    (validation ? getNumber(validation, ['v_score']) : undefined) ??
    (finalSnapshot ? getNumber(finalSnapshot, ['vScore', 'v_score']) : undefined) ??
    (driftReceipt ? getNumber(driftReceipt, ['vScore', 'v_score']) : undefined);
  const status =
    getString(record, ['status']) ??
    (finalSnapshot ? getString(finalSnapshot, ['status']) : undefined) ??
    (drift ? getString(drift, ['status']) : undefined) ??
    'unknown';
  const scoredAt =
    getString(record, ['scoredAt', 'scored_at', 'timestamp', 'canonized_at']) ??
    (finalSnapshot ? getString(finalSnapshot, ['scoredAt', 'scored_at']) : undefined) ??
    (drift ? getString(drift, ['scored_at']) : undefined) ??
    new Date(0).toISOString();

  if (!claimId) {
    throw new Error('CompareEngine could not determine claim id for a receipt.');
  }
  if (vScore == null) {
    throw new Error(`CompareEngine could not determine V-Score for claim ${claimId}.`);
  }

  const parsedMs = Date.parse(scoredAt);
  const scoredAtMs = Number.isFinite(parsedMs) ? parsedMs : 0;

  return {
    claimId,
    vScore: normalizeScore(vScore, options.normalize === true),
    status,
    scoredAt: Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : new Date(0).toISOString(),
    scoredAtMs,
    original: input,
  };
}

export function selectLatestPerClaim(
  receipts: unknown[],
  options: CompareOptions = {}
): Map<string, ParsedReceipt> {
  const grouped = new Map<string, ParsedReceipt>();

  for (const receipt of receipts) {
    const parsed = parseReceipt(receipt, options);
    const current = grouped.get(parsed.claimId);

    if (!current || parsed.scoredAtMs > current.scoredAtMs) {
      grouped.set(parsed.claimId, parsed);
    }
  }

  return grouped;
}

function leaderName(left: ParsedReceipt, right: ParsedReceipt): 'left' | 'right' | 'tie' {
  if (left.vScore === right.vScore) {
    return 'tie';
  }

  return left.vScore > right.vScore ? 'left' : 'right';
}

export function calculateDivergenceAt(
  receipts: unknown[],
  options: CompareOptions = {}
): string | undefined {
  if (!options.includeTimeline) {
    return undefined;
  }

  const grouped = new Map<string, ParsedReceipt[]>();
  for (const receipt of receipts) {
    const parsed = parseReceipt(receipt, options);
    const current = grouped.get(parsed.claimId) ?? [];
    current.push(parsed);
    grouped.set(parsed.claimId, current);
  }

  const claims = [...grouped.keys()].sort();
  if (claims.length !== 2) {
    return undefined;
  }

  const seriesA = (grouped.get(claims[0]) ?? []).sort((left, right) => left.scoredAtMs - right.scoredAtMs);
  const seriesB = (grouped.get(claims[1]) ?? []).sort((left, right) => left.scoredAtMs - right.scoredAtMs);

  if (seriesA.length < 2 || seriesB.length < 2) {
    return undefined;
  }

  const timestamps = [...new Set([...seriesA, ...seriesB].map((receipt) => receipt.scoredAtMs))]
    .sort((left, right) => left - right);

  let leftIndex = 0;
  let rightIndex = 0;
  let currentLeft: ParsedReceipt | undefined;
  let currentRight: ParsedReceipt | undefined;
  let baseline: 'left' | 'right' | 'tie' | undefined;

  for (const timestamp of timestamps) {
    while (leftIndex < seriesA.length && seriesA[leftIndex]!.scoredAtMs <= timestamp) {
      currentLeft = seriesA[leftIndex];
      leftIndex += 1;
    }
    while (rightIndex < seriesB.length && seriesB[rightIndex]!.scoredAtMs <= timestamp) {
      currentRight = seriesB[rightIndex];
      rightIndex += 1;
    }

    if (!currentLeft || !currentRight) {
      continue;
    }

    const leader = leaderName(currentLeft, currentRight);
    if (!baseline) {
      baseline = leader;
      continue;
    }

    if (baseline === 'tie' && leader !== 'tie') {
      return new Date(timestamp).toISOString();
    }

    if (leader !== 'tie' && baseline !== leader) {
      return new Date(timestamp).toISOString();
    }
  }

  return undefined;
}

export function compareReceipts(
  receipts: unknown[],
  options: CompareOptions = {}
): CompareResult {
  const grouped = selectLatestPerClaim(receipts, options);
  if (grouped.size !== 2) {
    throw new Error(`CompareEngine.compare() requires exactly 2 unique claims. Received ${grouped.size}.`);
  }

  const claims = [...grouped.keys()].sort();
  const receiptA = grouped.get(claims[0])!;
  const receiptB = grouped.get(claims[1])!;

  const winner = receiptA.vScore >= receiptB.vScore ? receiptA : receiptB;
  const loser = winner === receiptA ? receiptB : receiptA;
  const delta = Math.max(0, winner.vScore - loser.vScore);
  const divergenceAt = calculateDivergenceAt(receipts, options);
  const tie = receiptA.vScore === receiptB.vScore;

  return {
    winner: tie ? receiptA.original : winner.original,
    loser: tie ? receiptB.original : loser.original,
    delta,
    divergenceAt,
    summary: tie
      ? `Claim ${receiptA.claimId} and claim ${receiptB.claimId} are tied at V-Score ${receiptA.vScore.toFixed(1)}.`
      : `Claim ${winner.claimId} leads with V-Score ${winner.vScore.toFixed(1)} vs ${loser.claimId} at ${loser.vScore.toFixed(1)} for a delta of ${delta.toFixed(1)}.${divergenceAt ? ` Claims diverged ${divergenceAt}.` : ''}`,
    details: {
      receiptA: {
        claimId: receiptA.claimId,
        vScore: receiptA.vScore,
        status: receiptA.status,
      },
      receiptB: {
        claimId: receiptB.claimId,
        vScore: receiptB.vScore,
        status: receiptB.status,
      },
    },
  };
}

export function compareSeriesReceipts(
  receipts: unknown[],
  options: SeriesOptions = {}
): SeriesResult {
  const parsed = receipts.map((receipt) => parseReceipt(receipt));
  const claimIds = [...new Set(parsed.map((receipt) => receipt.claimId))];
  const claimId = options.claim ?? claimIds[0];

  if (!claimId) {
    throw new Error('CompareEngine.compareSeries() requires at least one receipt.');
  }

  const series = parsed
    .filter((receipt) => receipt.claimId === claimId)
    .sort((left, right) => left.scoredAtMs - right.scoredAtMs);

  if (series.length === 0) {
    throw new Error(`CompareEngine.compareSeries() could not find receipts for claim ${claimId}.`);
  }

  const peak = series.reduce((current, receipt) => (
    receipt.vScore > current.vScore ? receipt : current
  ));
  const latest = series[series.length - 1]!;
  const first = series[0]!;
  const changeRate = series.length < 2
    ? 0
    : (latest.vScore - first.vScore) / (series.length - 1);
  const netChange = latest.vScore - first.vScore;
  const trend = netChange > 2 ? 'improving' : netChange < -2 ? 'declining' : 'stable';

  return {
    claimId,
    trend,
    peakScore: peak.vScore,
    peakAt: peak.scoredAtMs,
    latestScore: latest.vScore,
    changeRate,
    summary: `Claim ${claimId} is ${trend} with latest V-Score ${latest.vScore.toFixed(1)}, peak ${peak.vScore.toFixed(1)}, and average change ${changeRate.toFixed(2)} per period.`,
  };
}
