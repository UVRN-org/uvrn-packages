import type { MeasurementSource, NodeStatus } from '@uvrn/core';

export type StanceLabel =
  | 'supports'
  | 'opposes'
  | 'mixed'
  | 'neutral'
  | 'insufficient';

export interface StanceSource {
  id: string;
  label?: string;
  ts?: string;
  status?: NodeStatus;
  stanceValue?: number;
  stanceLabel?: StanceLabel;
  stanceConfidence?: number;
  stanceEvidence?: string;
}

export interface StanceMeasurementProjection {
  numeric: MeasurementSource[];
  categorical: MeasurementSource[];
}

const VALID_LABELS: readonly StanceLabel[] = [
  'supports',
  'opposes',
  'mixed',
  'neutral',
  'insufficient',
];

function isGrounded(source: StanceSource): boolean {
  return (
    typeof source.stanceLabel === 'string' &&
    VALID_LABELS.includes(source.stanceLabel) &&
    source.stanceLabel !== 'insufficient' &&
    typeof source.stanceEvidence === 'string' &&
    source.stanceEvidence.trim().length > 0 &&
    typeof source.stanceConfidence === 'number' &&
    Number.isFinite(source.stanceConfidence) &&
    source.stanceConfidence >= 0.6 &&
    source.stanceConfidence <= 1
  );
}

function optionalSourceFields(source: StanceSource): Partial<MeasurementSource> {
  return {
    ...(source.label !== undefined ? { label: source.label } : {}),
    ...(source.ts !== undefined ? { ts: source.ts } : {}),
    ...(source.status !== undefined ? { status: source.status } : {}),
  };
}

/**
 * Pure named projection seam from ADR-011. Input order is preserved and
 * ungrounded evidence is excluded rather than repaired or guessed.
 */
export function stanceToMeasurementSources(
  sources: readonly StanceSource[]
): StanceMeasurementProjection {
  const numeric: MeasurementSource[] = [];
  const categorical: MeasurementSource[] = [];

  for (const source of sources) {
    if (!isGrounded(source)) continue;

    if (
      typeof source.stanceValue === 'number' &&
      Number.isFinite(source.stanceValue) &&
      source.stanceValue >= -1 &&
      source.stanceValue <= 1
    ) {
      numeric.push({
        id: source.id,
        kind: 'numeric',
        value: source.stanceValue,
        ...optionalSourceFields(source),
        attributes: {
          field: 'claim-stance',
          stanceLabel: source.stanceLabel,
        },
      });
    }

    if (source.stanceLabel === 'supports' || source.stanceLabel === 'opposes') {
      categorical.push({
        id: source.id,
        kind: 'categorical',
        assertion: source.stanceLabel,
        ...optionalSourceFields(source),
        attributes: { field: 'claim-stance' },
      });
    }
  }

  return { numeric, categorical };
}
