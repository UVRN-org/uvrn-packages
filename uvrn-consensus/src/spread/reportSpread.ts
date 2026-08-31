// Named host-facing spread readout (BP-v2.1-Spread).
// Chosen export name: `reportSpread` (do not also ship an opportunity-score API).
//
// Honest vocabulary: reports divergence **state** (magnitude + sign) between role
// partitions. Not an opportunity/accuracy score, not "buy now" / guaranteed edge.
// Apps own narrative.
//
// Magnitude formula (defaults):
//   demandClass default = attention; supplyClass default = supply_entry
//   representative = mean of first-seen metricValue per originId within class
//   magnitude = |demand − supply| / max((|demand|+|supply|)/2, 1e-9)
//   sign = sign(demand − supply) ∈ {-1,0,1}
// Incomplete axis → magnitude/sign/signedDivergence = null (withheld), not 0.

import { calculateClassPartitionedAgreement } from './classPartitionedAgreement';
import { labelRoles } from './role';
import type {
  EvidenceClass,
  ReportSpreadOptions,
  SpreadReadout,
  SpreadSign,
  SpreadSourceInput,
} from './types';

const DEFAULT_DEMAND: EvidenceClass = 'attention';
const DEFAULT_SUPPLY: EvidenceClass = 'supply_entry';

/**
 * Origin-first representative: first-seen value per originId, then mean of those votes.
 * Sources without originId are omitted from the representative (honest incomplete).
 */
function representativeValue(
  sources: SpreadSourceInput[]
): { value: number | null; originIncomplete: boolean } {
  const originValue = new Map<string, number>();
  let missingOrigin = 0;
  for (const source of sources) {
    if (typeof source.originId !== 'string' || source.originId.length === 0) {
      missingOrigin += 1;
      continue;
    }
    if (!originValue.has(source.originId)) {
      originValue.set(source.originId, source.metricValue);
    }
  }
  if (originValue.size === 0) {
    return { value: null, originIncomplete: missingOrigin > 0 || sources.length > 0 };
  }
  let sum = 0;
  for (const v of originValue.values()) sum += v;
  return {
    value: sum / originValue.size,
    originIncomplete: missingOrigin > 0,
  };
}

function signFromDelta(delta: number): SpreadSign {
  if (delta > 0) return 1;
  if (delta < 0) return -1;
  return 0;
}

/** Relative gap |demand − supply| / midpoint; midpoint floor 1e-9. */
function relativeMagnitude(demand: number, supply: number): number {
  const mid = (Math.abs(demand) + Math.abs(supply)) / 2;
  const denom = mid < 1e-9 ? 1e-9 : mid;
  return Math.abs(demand - supply) / denom;
}

function buildInterpretation(readout: {
  incomplete: boolean;
  magnitude: number | null;
  sign: SpreadSign | null;
  demandClass: EvidenceClass;
  supplyClass: EvidenceClass;
  demandRepresentative: number | null;
  supplyRepresentative: number | null;
}): string {
  if (readout.magnitude === null || readout.sign === null) {
    return (
      `Spread incomplete: magnitude/sign withheld (not balanced). Need representatives ` +
      `for both ${readout.demandClass} and ${readout.supplyClass} under declared/assumed ` +
      `roles. Divergence state not claimed.`
    );
  }
  const direction =
    readout.sign === 0
      ? 'balanced (sign 0)'
      : readout.sign > 0
        ? `${readout.demandClass} above ${readout.supplyClass}`
        : `${readout.demandClass} below ${readout.supplyClass}`;
  const incompleteNote = readout.incomplete
    ? ' Incomplete flags present — see incompleteReasons.'
    : '';
  return (
    `Cross-role divergence state: magnitude ${readout.magnitude.toFixed(4)}, ` +
    `sign ${readout.sign} (${direction}). Reports partition gap as state only; ` +
    `hosts own any narrative.${incompleteNote}`
  );
}

/**
 * Named spread readout: class-partitioned within-role agreement (C-2) plus
 * signed cross-role divergence (C-3) for host-declared role partitions.
 *
 * Missing / unknown roles stay organized and force `incomplete` for PASS math —
 * they are never silently substituted for a declared role.
 * Incomplete axis withholds magnitude/sign as null (distinct from balanced 0/0).
 */
export function reportSpread(
  sources: SpreadSourceInput[],
  options: ReportSpreadOptions = {}
): SpreadReadout {
  const demandClass = options.demandClass ?? DEFAULT_DEMAND;
  const supplyClass = options.supplyClass ?? DEFAULT_SUPPLY;
  const labeled = labelRoles(sources);
  const classAgreement = calculateClassPartitionedAgreement(labeled);
  const incompleteReasons = [...classAgreement.incompleteReasons];

  if (demandClass === supplyClass) {
    incompleteReasons.push(
      'demandClass and supplyClass are identical — signed axis is undefined'
    );
  }

  const demandSources = classAgreement.organized.byClass[demandClass];
  const supplySources = classAgreement.organized.byClass[supplyClass];

  if (demandSources.length === 0) {
    incompleteReasons.push(`no partitionable sources for demandClass ${demandClass}`);
  }
  if (supplySources.length === 0) {
    incompleteReasons.push(`no partitionable sources for supplyClass ${supplyClass}`);
  }

  const demandRep = representativeValue(demandSources);
  const supplyRep = representativeValue(supplySources);
  if (demandRep.originIncomplete) {
    incompleteReasons.push(
      `demandClass ${demandClass}: originId incomplete for representative`
    );
  }
  if (supplyRep.originIncomplete) {
    incompleteReasons.push(
      `supplyClass ${supplyClass}: originId incomplete for representative`
    );
  }

  let magnitude: number | null = null;
  let sign: SpreadSign | null = null;
  const axisReady =
    demandRep.value !== null &&
    supplyRep.value !== null &&
    demandClass !== supplyClass;

  if (axisReady) {
    const delta = demandRep.value! - supplyRep.value!;
    sign = signFromDelta(delta);
    magnitude = relativeMagnitude(demandRep.value!, supplyRep.value!);
  } else {
    incompleteReasons.push(
      'magnitude/sign withheld — missing demand or supply representative (not balanced 0)'
    );
  }

  const partitions = classAgreement.partitions.map((p) => {
    const rep = representativeValue(classAgreement.organized.byClass[p.evidenceClass]);
    return {
      evidenceClass: p.evidenceClass,
      representativeValue: rep.value,
      originAgreementScore: p.originAgreementScore,
      distinctOriginCount: p.distinctOriginCount,
      sourceCount: p.sourceCount,
    };
  });

  const seen = new Set<string>();
  const uniqueReasons: string[] = [];
  for (const reason of incompleteReasons) {
    if (!seen.has(reason)) {
      seen.add(reason);
      uniqueReasons.push(reason);
    }
  }

  const incomplete = uniqueReasons.length > 0;
  const signedDivergence =
    magnitude === null || sign === null ? null : magnitude * sign;

  const readout: SpreadReadout = {
    magnitude,
    sign,
    signedDivergence,
    demandClass,
    supplyClass,
    demandRepresentative: demandRep.value,
    supplyRepresentative: supplyRep.value,
    partitions,
    classAgreement: {
      ...classAgreement,
      incomplete,
      incompleteReasons: uniqueReasons,
    },
    incomplete,
    incompleteReasons: uniqueReasons,
    interpretation: '',
  };
  readout.interpretation = buildInterpretation(readout);
  return readout;
}
