// C-2 class-partitioned agreement (BP-v2.1-Spread).
// Additive helper — does not mutate calculateOriginAgreementScore / ConsensusEngine parity.
// Within-class disagreement may lower per-partition confidence; cross-class numeric gaps
// are reported by reportSpread — not folded into a single parity score.

import { calculateOriginAgreementScore } from '../engine/aggregation';
import { isPartitionableRole, organizeByRole } from './role';
import type {
  ClassAgreementPartition,
  ClassPartitionedAgreementResult,
  EvidenceClass,
  SpreadSourceInput,
} from './types';

const CLASS_ORDER: EvidenceClass[] = [
  'attention',
  'interest',
  'supply_entry',
  'purchase',
  'repeat_purchase',
  'commercial_outcome',
  'market_expansion',
];

/**
 * Compute origin-agreement **within** each EvidenceClass partition.
 * `multipleClassesPresent` is presence-only (2+ partitions) — not measured divergence.
 */
export function calculateClassPartitionedAgreement(
  sources: SpreadSourceInput[]
): ClassPartitionedAgreementResult {
  const organized = organizeByRole(sources);
  const incompleteReasons: string[] = [];

  if (organized.noRole.length > 0) {
    incompleteReasons.push(
      `${organized.noRole.length} source(s) labeled no_role — excluded from Spread PASS partition math`
    );
  }
  if (organized.incompleteAssumed.length > 0) {
    incompleteReasons.push(
      `${organized.incompleteAssumed.length} source(s) incomplete assumed (missing why and/or class) — excluded from Spread PASS partition math`
    );
  }
  if (organized.unknown.length > 0) {
    incompleteReasons.push(
      `${organized.unknown.length} source(s) labeled unknown — excluded from Spread PASS partition math`
    );
  }

  for (const source of sources) {
    const role = source.role;
    if (role && (role.provenance === 'declared' || role.provenance === 'assumed')) {
      if (
        !isPartitionableRole({
          provenance: role.provenance,
          evidenceClass: role.evidenceClass,
          why: role.why,
        })
      ) {
        if (role.evidenceClass === undefined) {
          const msg = `source ${source.id}: ${role.provenance} role missing evidenceClass`;
          if (!incompleteReasons.includes(msg)) incompleteReasons.push(msg);
        }
      }
    }
  }

  const partitions: ClassAgreementPartition[] = [];

  for (const evidenceClass of CLASS_ORDER) {
    const classSources = organized.byClass[evidenceClass];
    if (classSources.length === 0) continue;

    const withOrigin = classSources.filter(
      (s): s is SpreadSourceInput & { originId: string } =>
        typeof s.originId === 'string' && s.originId.length > 0
    );
    const originIncomplete = withOrigin.length < classSources.length;
    if (originIncomplete) {
      incompleteReasons.push(
        `class ${evidenceClass}: ${classSources.length - withOrigin.length} source(s) missing originId`
      );
    }

    const originAgreementScore =
      withOrigin.length === 0
        ? 0
        : calculateOriginAgreementScore(
            withOrigin.map((s) => ({
              metricValue: s.metricValue,
              originId: s.originId,
            }))
          );

    const distinctOriginCount = new Set(withOrigin.map((s) => s.originId)).size;

    partitions.push({
      evidenceClass,
      originAgreementScore,
      distinctOriginCount,
      sourceCount: classSources.length,
      originIncomplete,
    });
  }

  const completeScores = partitions
    .filter((p) => !p.originIncomplete && p.distinctOriginCount > 0)
    .map((p) => p.originAgreementScore);
  const withinClassMinAgreement =
    completeScores.length === 0 ? null : Math.min(...completeScores);

  return {
    partitions,
    withinClassMinAgreement,
    multipleClassesPresent: partitions.length >= 2,
    incomplete: incompleteReasons.length > 0,
    incompleteReasons,
    organized,
  };
}
