import type { FarmSource, StanceLabel, StanceMode } from '../types';

export const STANCE_QUORUM_SOURCES = 4 as const;
export const STANCE_QUORUM_GROUNDED = 3 as const;
export const STANCE_CONFIDENCE_MIN = 0.6 as const;

const STANCE_LABELS: readonly StanceLabel[] = [
  'supports',
  'opposes',
  'mixed',
  'neutral',
  'insufficient',
];

export function isGroundedStanceSource(source: FarmSource): boolean {
  return (
    typeof source.stanceLabel === 'string' &&
    STANCE_LABELS.includes(source.stanceLabel) &&
    source.stanceLabel !== 'insufficient' &&
    typeof source.stanceEvidence === 'string' &&
    source.stanceEvidence.trim().length > 0 &&
    typeof source.stanceConfidence === 'number' &&
    Number.isFinite(source.stanceConfidence) &&
    source.stanceConfidence >= STANCE_CONFIDENCE_MIN &&
    source.stanceConfidence <= 1
  );
}

/** Pure activation decision from uvrn-stance-v1 §3 (D6, ADR-011). */
export function evaluateStanceMode(sources: readonly FarmSource[]): StanceMode {
  const sourceCount = sources.length;
  const groundedCount = sources.filter(isGroundedStanceSource).length;
  const quorumMet =
    sourceCount >= STANCE_QUORUM_SOURCES &&
    groundedCount >= STANCE_QUORUM_GROUNDED;

  return {
    evidenceAxis: quorumMet ? 'stance' : 'prominence',
    sourceCount,
    groundedCount,
    requiredSources: STANCE_QUORUM_SOURCES,
    requiredGrounded: STANCE_QUORUM_GROUNDED,
    confidenceFloor: STANCE_CONFIDENCE_MIN,
    quorumMet,
    ...(!quorumMet
      ? {
          fallbackReason:
            sourceCount < STANCE_QUORUM_SOURCES
              ? ('source-quorum-missed' as const)
              : ('grounded-quorum-missed' as const),
        }
      : {}),
  };
}
