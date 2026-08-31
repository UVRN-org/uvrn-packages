/**
 * Source-quality diagnostics (BP-v2.1-LATER-D2).
 *
 * Pure, fixture-friendly assessment of weak / inconsistent stanceLabel,
 * evidenceScore, and credibility inputs. Output is render-only / non-hashed —
 * never enters NETWORK_RECEIPT_HASH_FIELDS or master/delta hash lists.
 */

export type StanceLabelInput =
  | 'supports'
  | 'opposes'
  | 'mixed'
  | 'neutral'
  | 'insufficient';

/** Per-source quality inputs supplied by the host (or attached non-hashed on the envelope). */
export interface SourceQualityInput {
  /** Stable source id for machine-checkable refs (url, node id, etc.). */
  id: string;
  stanceLabel?: StanceLabelInput | string;
  stanceValue?: number;
  stanceConfidence?: number;
  stanceEvidence?: string;
  /** Declared evidence quality score on 0–100 (or absent). */
  evidenceScore?: number;
  /**
   * Declared credibility. Hosts may pass 0–1 or 0–100.
   * Absent means undeclared (would silently default to mid-scale in weighting).
   */
  credibility?: number;
}

export type SourceQualityKind = 'weak' | 'inconsistent';

export type SourceQualityCode =
  | 'stanceLabel.missing'
  | 'stanceLabel.insufficient'
  | 'stanceLabel.ungrounded'
  | 'stanceLabel.value_inconsistent'
  | 'evidenceScore.missing'
  | 'evidenceScore.weak'
  | 'evidenceScore.confidence_theater'
  | 'credibility.missing'
  | 'credibility.weak'
  | 'credibility.defaulted_as_strong'
  | 'confidence.theater_risk';

export interface SourceQualityDiagnostic {
  code: SourceQualityCode;
  kind: SourceQualityKind;
  /** Source id, or `*` for run-level diagnostics. */
  sourceId: string;
  field: 'stanceLabel' | 'evidenceScore' | 'credibility' | 'confidence';
  /** Machine-checkable observation — never claims high confidence or proof. */
  note: string;
}

/** Documented AC matrix thresholds (fixture-stable). */
export const SOURCE_QUALITY_THRESHOLDS = {
  /** evidenceScore below this (0–100) is weak. */
  weakEvidenceScore: 30,
  /** Normalized credibility below this (0–100) is weak. */
  weakCredibilityScore: 30,
  /** Stance confidence at/above this with weak evidence is theater. */
  highStanceConfidence: 0.9,
  /** Grounded-source floor from uvrn-stance-v1 §2.1 / §3. */
  stanceConfidenceFloor: 0.6,
} as const;

const VALID_STANCE_LABELS: readonly StanceLabelInput[] = [
  'supports',
  'opposes',
  'mixed',
  'neutral',
  'insufficient',
];

const OVERSTATEMENT =
  /\b(high(?:ly)?\s+confiden(?:t|ce)|certain(?:ly)?|proven|verified\b|definitive)\b/i;

function normalizeCredibilityScore(value?: number): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  if (value <= 1) return Math.min(100, Math.max(0, value * 100));
  return Math.min(100, Math.max(0, value));
}

function hasAnyStanceField(source: SourceQualityInput): boolean {
  return (
    source.stanceLabel !== undefined ||
    source.stanceValue !== undefined ||
    source.stanceConfidence !== undefined ||
    (typeof source.stanceEvidence === 'string' && source.stanceEvidence.length > 0)
  );
}

function isValidStanceLabel(label: unknown): label is StanceLabelInput {
  return typeof label === 'string' && (VALID_STANCE_LABELS as readonly string[]).includes(label);
}

/**
 * Assess source-quality inputs against the D2 AC matrix.
 * Returns deterministic diagnostics sorted by (code, sourceId).
 */
export function assessSourceQuality(
  sources: readonly SourceQualityInput[]
): SourceQualityDiagnostic[] {
  const out: SourceQualityDiagnostic[] = [];

  for (const source of sources) {
    const id = typeof source.id === 'string' && source.id.length > 0 ? source.id : 'unknown';

    // --- stanceLabel ---
    const stancePresent = hasAnyStanceField(source);
    if (stancePresent && source.stanceLabel === undefined) {
      out.push({
        code: 'stanceLabel.missing',
        kind: 'weak',
        sourceId: id,
        field: 'stanceLabel',
        note: 'Stance fields were supplied without stanceLabel — categorical stance is undeclared.',
      });
    } else if (source.stanceLabel === 'insufficient') {
      out.push({
        code: 'stanceLabel.insufficient',
        kind: 'weak',
        sourceId: id,
        field: 'stanceLabel',
        note: 'stanceLabel is insufficient — source does not ground a usable stance.',
      });
    } else if (source.stanceLabel !== undefined && !isValidStanceLabel(source.stanceLabel)) {
      out.push({
        code: 'stanceLabel.missing',
        kind: 'weak',
        sourceId: id,
        field: 'stanceLabel',
        note: 'stanceLabel is not a valid categorical label — treated as undeclared.',
      });
    } else if (isValidStanceLabel(source.stanceLabel) && source.stanceLabel !== 'insufficient') {
      const evidenceOk =
        typeof source.stanceEvidence === 'string' && source.stanceEvidence.trim().length > 0;
      const confOk =
        typeof source.stanceConfidence === 'number' &&
        Number.isFinite(source.stanceConfidence) &&
        source.stanceConfidence >= SOURCE_QUALITY_THRESHOLDS.stanceConfidenceFloor;
      if (!evidenceOk || !confOk) {
        out.push({
          code: 'stanceLabel.ungrounded',
          kind: 'weak',
          sourceId: id,
          field: 'stanceLabel',
          note: 'stanceLabel is present but source fails grounded checks (evidence text and/or confidence floor).',
        });
      }

      if (
        typeof source.stanceValue === 'number' &&
        Number.isFinite(source.stanceValue) &&
        ((source.stanceLabel === 'supports' && source.stanceValue < 0) ||
          (source.stanceLabel === 'opposes' && source.stanceValue > 0))
      ) {
        out.push({
          code: 'stanceLabel.value_inconsistent',
          kind: 'inconsistent',
          sourceId: id,
          field: 'stanceLabel',
          note: 'stanceLabel and stanceValue point in opposite directions — recorded, not reconciled.',
        });
      }
    }

    // --- evidenceScore ---
    const evidenceMissing =
      source.evidenceScore === undefined ||
      !Number.isFinite(source.evidenceScore);
    if (evidenceMissing) {
      out.push({
        code: 'evidenceScore.missing',
        kind: 'weak',
        sourceId: id,
        field: 'evidenceScore',
        note: 'evidenceScore is absent or non-finite — no declared evidence quality.',
      });
    } else if (
      (source.evidenceScore as number) < SOURCE_QUALITY_THRESHOLDS.weakEvidenceScore
    ) {
      out.push({
        code: 'evidenceScore.weak',
        kind: 'weak',
        sourceId: id,
        field: 'evidenceScore',
        note: `evidenceScore ${source.evidenceScore} is below the weak threshold (${SOURCE_QUALITY_THRESHOLDS.weakEvidenceScore}).`,
      });
    }

    const highConf =
      typeof source.stanceConfidence === 'number' &&
      Number.isFinite(source.stanceConfidence) &&
      source.stanceConfidence >= SOURCE_QUALITY_THRESHOLDS.highStanceConfidence;
    if (
      highConf &&
      (evidenceMissing ||
        (source.evidenceScore as number) < SOURCE_QUALITY_THRESHOLDS.weakEvidenceScore)
    ) {
      out.push({
        code: 'evidenceScore.confidence_theater',
        kind: 'inconsistent',
        sourceId: id,
        field: 'evidenceScore',
        note: 'High stanceConfidence accompanies weak or missing evidenceScore — confidence is not earned by evidence quality.',
      });
    }

    // --- credibility ---
    const credNorm = normalizeCredibilityScore(source.credibility);
    if (credNorm === undefined) {
      out.push({
        code: 'credibility.missing',
        kind: 'weak',
        sourceId: id,
        field: 'credibility',
        note: 'credibility is undeclared — weighting would silently mid-default; recorded as weak input.',
      });
      if (highConf) {
        out.push({
          code: 'credibility.defaulted_as_strong',
          kind: 'inconsistent',
          sourceId: id,
          field: 'credibility',
          note: 'Undeclared credibility paired with high stanceConfidence — do not treat as strong provenance.',
        });
      }
    } else if (credNorm < SOURCE_QUALITY_THRESHOLDS.weakCredibilityScore) {
      out.push({
        code: 'credibility.weak',
        kind: 'weak',
        sourceId: id,
        field: 'credibility',
        note: `credibility normalizes to ${credNorm}, below the weak threshold (${SOURCE_QUALITY_THRESHOLDS.weakCredibilityScore}).`,
      });
    }
  }

  out.sort((a, b) => a.code.localeCompare(b.code) || a.sourceId.localeCompare(b.sourceId));

  for (const d of out) {
    if (OVERSTATEMENT.test(d.note)) {
      throw new Error(`source-quality note must not overstate confidence: ${d.code}`);
    }
  }

  return out;
}

/**
 * When weak/inconsistent source-quality diagnostics exist alongside an aligned
 * high-confidence measurement story, emit a run-level theater-risk diagnostic.
 */
export function assessConfidenceTheaterRisk(args: {
  diagnostics: readonly SourceQualityDiagnostic[];
  verdictTone: string;
  measurementConfidences: readonly number[];
}): SourceQualityDiagnostic | undefined {
  const hasQualityIssue = args.diagnostics.some(
    (d) => d.kind === 'weak' || d.kind === 'inconsistent'
  );
  if (!hasQualityIssue) return undefined;
  if (args.verdictTone !== 'aligned') return undefined;
  const highMeasurement = args.measurementConfidences.some(
    (c) => Number.isFinite(c) && c >= SOURCE_QUALITY_THRESHOLDS.highStanceConfidence
  );
  if (!highMeasurement) return undefined;
  return {
    code: 'confidence.theater_risk',
    kind: 'inconsistent',
    sourceId: '*',
    field: 'confidence',
    note: 'Aligned verdict carries high measurement confidence while source-quality inputs are weak or inconsistent — do not read as earned certainty.',
  };
}
