/**
 * The combiner (SPEC §5): evaluate every supplied candidate, apply the v1 precedence rule
 * (liquid + fresh market → market; else base rate; else insufficient_basis), and receipt the
 * result. No blending and no adjustments in v1. Both candidates are always reported.
 */

import type { NetworkReceipt } from '@uvrn/receipt';
import { evaluateBaseRate, type BaseRateInput } from './baserate/evaluate';
import { citationProblem, copyCitation, type Citation } from './common/citation';
import { ProbabilityInputError, refusal, type Refusal } from './common/refusal';
import { resolveThresholds, DEFAULT_THRESHOLDS, type Thresholds } from './common/thresholds';
import { parseZoned, toUtcIso } from './common/time';
import type { Candidate } from './common/types';
import { evaluateMarket, type MarketInput } from './odds/market';
import {
  buildProbabilityReceipt,
  computeProbabilityHash,
  type ProbabilityHashPayload,
  type ProbabilityMethod,
  type ProbabilitySigner,
} from './receipt';
import { LEGACY_PROBABILITY_ORIGIN, PROBABILITY_INPUT_VERSION, PROBABILITY_SPEC_VERSION } from './version';

const OUTCOME_HASH = /^sha256:[0-9a-f]{64}$/;

export interface ProbabilityRunInput {
  specVersion: typeof PROBABILITY_INPUT_VERSION;
  /** Reference to an immutable uvrn-outcome-1 declaration (SPEC uvrn-outcome-v1 §3). */
  outcome: { outcomeHash: string };
  /** The evaluation instant: zoned ISO timestamp plus the citation that fixes it. */
  asOf: { at: string; source: Citation };
  market?: MarketInput;
  baserate?: BaseRateInput;
  /** Optional overrides of the PROVISIONAL thresholds; always recorded in inputs[]. */
  thresholds?: Partial<Thresholds>;
}

export interface RunOptions {
  /** Ed25519 producer key. Omit for an unsigned (integrity-checkable only) receipt. */
  signer?: ProbabilitySigner;
}

/** Typed-observation projection for downstream desks (SPEC §5.5). UCUM unit "1". */
export interface ProbabilitySource {
  value: number;
  unit: '1';
  quantityKind: 'probability';
  origin: string;
  measuredAt: string;
  obsStatus: 'F';
  codeLists: { ucum: 'ucum-2.1'; clObsStatus: 'sdmx-2.1/CL_OBS_STATUS' };
  receiptHash: string;
}

export interface ProbabilityResult extends ProbabilityHashPayload {
  probabilityHash: string;
  /** Null when method is insufficient_basis. */
  source: ProbabilitySource | null;
  receipt: NetworkReceipt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * runProbability evaluates one input deterministically. It throws ProbabilityInputError only when
 * the output cannot be bound to a question (outcomeHash) or an instant (asOf.at); every other
 * problem becomes a typed refusal in a receipted insufficient_basis result.
 */
export function runProbability(input: ProbabilityRunInput, options: RunOptions = {}): ProbabilityResult {
  if (!isRecord(input)) throw new ProbabilityInputError('input must be an object');
  const outcomeHash = isRecord(input.outcome) ? input.outcome.outcomeHash : undefined;
  if (typeof outcomeHash !== 'string' || !OUTCOME_HASH.test(outcomeHash)) {
    throw new ProbabilityInputError('outcome.outcomeHash must be a uvrn-outcome-1 hash (sha256:<64 hex>)');
  }
  const asOfRaw: Record<string, unknown> = isRecord(input.asOf) ? input.asOf : {};
  const asOfMs = parseZoned(asOfRaw.at);
  if (asOfMs === null) {
    throw new ProbabilityInputError('asOf.at must be an ISO 8601 timestamp with a timezone (Z or ±hh:mm)');
  }
  const asOf = toUtcIso(asOfMs);

  const inputRefusals: Refusal[] = [];
  if (input.specVersion !== PROBABILITY_INPUT_VERSION) {
    inputRefusals.push(refusal('invalid_input', 'input', `specVersion must be "${PROBABILITY_INPUT_VERSION}"`));
  }
  const asOfCitation = citationProblem(asOfRaw.source);
  if (asOfCitation) inputRefusals.push(refusal('missing_citation', 'input', `asOf.source: ${asOfCitation}`));

  let thresholds: Thresholds = { ...DEFAULT_THRESHOLDS };
  let overridden: string[] = [];
  try {
    const resolved = resolveThresholds(isRecord(input.thresholds) ? (input.thresholds as Partial<Thresholds>) : undefined);
    thresholds = resolved.thresholds;
    overridden = resolved.overridden;
  } catch (cause) {
    inputRefusals.push(refusal('invalid_input', 'input', (cause as Error).message));
  }

  const hasMarket = input.market !== undefined;
  const hasBaseRate = input.baserate !== undefined;
  if (!hasMarket && !hasBaseRate) {
    inputRefusals.push(refusal('no_candidate', 'input', 'neither a market nor a base-rate input was supplied'));
  }

  const ctx = { asOfMs, thresholds };
  const market = hasMarket ? evaluateMarket(input.market as MarketInput, ctx) : null;
  const baserate = hasBaseRate ? evaluateBaseRate(input.baserate as BaseRateInput, ctx) : null;

  let method: ProbabilityMethod = 'insufficient_basis';
  let chosen: Candidate | null = null;
  if (inputRefusals.length === 0) {
    if (market?.candidate) {
      method = 'market';
      chosen = market.candidate;
      market.record.status = 'selected';
    } else if (baserate?.candidate) {
      method = 'baserate';
      chosen = baserate.candidate;
      baserate.record.status = 'selected';
    }
  }

  const inputs: Array<Record<string, unknown>> = [
    {
      role: 'asOf',
      at: String(asOfRaw.at),
      atUtc: asOf,
      source: asOfCitation ? null : copyCitation(asOfRaw.source as Citation),
    },
    {
      role: 'thresholds',
      provisional: true,
      values: { ...thresholds },
      overridden,
    },
  ];
  if (market) inputs.push(market.record as unknown as Record<string, unknown>);
  if (baserate) inputs.push(baserate.record as unknown as Record<string, unknown>);

  const refusals: Refusal[] = [
    ...inputRefusals,
    ...((market?.refusals ?? []) as Refusal[]),
    ...((baserate?.refusals ?? []) as Refusal[]),
  ];
  if (method === 'insufficient_basis' && refusals.length === 0) {
    refusals.push(refusal('no_candidate', 'input', 'no candidate produced a probability'));
  }

  const payload: ProbabilityHashPayload = {
    specVersion: PROBABILITY_SPEC_VERSION,
    origin: LEGACY_PROBABILITY_ORIGIN,
    outcomeHash,
    asOf,
    method,
    p: chosen ? chosen.p : null,
    low: chosen ? chosen.low : null,
    high: chosen ? chosen.high : null,
    inputs: JSON.parse(JSON.stringify(inputs)),
    refusals,
  };
  const probabilityHash = computeProbabilityHash(payload as unknown as Record<string, unknown>);
  const receipt = buildProbabilityReceipt({ ...payload, probabilityHash }, options.signer);

  const source: ProbabilitySource | null = chosen
    ? {
        value: chosen.p,
        unit: '1',
        quantityKind: 'probability',
        origin: LEGACY_PROBABILITY_ORIGIN,
        measuredAt: asOf,
        obsStatus: 'F',
        codeLists: { ucum: 'ucum-2.1', clObsStatus: 'sdmx-2.1/CL_OBS_STATUS' },
        receiptHash: receipt.receiptHash,
      }
    : null;

  return { ...payload, probabilityHash, source, receipt };
}
