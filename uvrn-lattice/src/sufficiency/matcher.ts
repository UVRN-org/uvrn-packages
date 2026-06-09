import { CLAIM_LADDER, LADDER_ORDER } from './ladder';
import type {
  ClaimLevel,
  ClaimSpec,
  CoverageBand,
  EvidenceClass,
  EvidenceItem,
  SufficiencyVerdict,
} from './types';

// Neutral strength used when an evidence item carries no genuine strength signal (e.g. items
// bridged from lattice DomainSignals, whose 0..100 value is a consensus metric, not evidence
// strength).
const NEUTRAL_STRENGTH = 60;

export interface MatchOptions {
  ts?: string;
}

// Pure, deterministic matcher. Intersects the claim's required evidence classes with what was
// obtained and emits a Supported/Unverified verdict plus a coverage-based score. Never touches
// V-Score / delta math.
export function matchSufficiency(
  claim: ClaimSpec,
  evidence: EvidenceItem[],
  options: MatchOptions = {}
): SufficiencyVerdict {
  const ts = options.ts ?? new Date().toISOString();
  const required = unique(claim.requiredEvidence);
  const obtained = unique(evidence.map((item) => item.evidenceClass));
  const matched = required.filter((cls) => obtained.includes(cls));
  const missing = required.filter((cls) => !obtained.includes(cls));
  const status = missing.length === 0 ? 'Supported' : 'Unverified';

  const evidenceCoverageScore = computeCoverageScore(required, matched, evidence);
  const coverageBand = bandFor(evidenceCoverageScore, status);
  const licensedClaimLevel = highestLicensedLevel(obtained);
  const interpretation = buildInterpretation(status, coverageBand, missing, licensedClaimLevel);

  return {
    claim: claim.text,
    claimId: claim.claimId,
    level: claim.level,
    status,
    coverageBand,
    evidenceCoverageScore,
    requiredEvidence: required,
    obtainedEvidence: obtained,
    missingEvidence: missing,
    matchedEvidence: matched,
    licensedClaimLevel,
    interpretation,
    explanation: `Evidence sufficiency for a ${claim.level} (${CLAIM_LADDER[claim.level].verbClass}) claim, graded by coverage of required evidence classes. Independent of the V-Score.`,
    ts,
  };
}

function computeCoverageScore(
  required: EvidenceClass[],
  matched: EvidenceClass[],
  evidence: EvidenceItem[]
): number {
  if (required.length === 0) {
    return 0;
  }

  const coverage = matched.length / required.length;
  const matchedItems = evidence.filter((item) => matched.includes(item.evidenceClass));

  const strength =
    matchedItems.length === 0
      ? 0
      : matchedItems.reduce((sum, item) => sum + (item.value ?? NEUTRAL_STRENGTH), 0) /
        matchedItems.length /
        100;

  const distinctSources = unique(matchedItems.map((item) => item.source)).length;
  const corroboration = Math.min(distinctSources / 2, 1);

  const score = coverage * (0.5 + 0.25 * strength + 0.25 * corroboration);
  return clamp01(round3(score));
}

function bandFor(score: number, status: SufficiencyVerdict['status']): CoverageBand {
  let band: CoverageBand;
  if (score >= 0.75) {
    band = 'high';
  } else if (score >= 0.45) {
    band = 'moderate';
  } else if (score > 0) {
    band = 'low';
  } else {
    band = 'none';
  }

  // Honest output: an Unverified claim never reports better than `low`, regardless of partial
  // coverage on the classes it did match.
  if (status === 'Unverified' && (band === 'moderate' || band === 'high')) {
    return 'low';
  }
  return band;
}

// Highest ladder level whose required evidence classes are all present in `obtained`.
function highestLicensedLevel(obtained: EvidenceClass[]): ClaimLevel | null {
  let licensed: ClaimLevel | null = null;
  for (const level of LADDER_ORDER) {
    const needed = CLAIM_LADDER[level].requiredEvidence;
    if (needed.every((cls) => obtained.includes(cls))) {
      licensed = level;
    }
  }
  return licensed;
}

function buildInterpretation(
  status: SufficiencyVerdict['status'],
  band: CoverageBand,
  missing: EvidenceClass[],
  licensedClaimLevel: ClaimLevel | null
): string {
  const licenses = licensedClaimLevel
    ? `Evidence licenses claims up to ${licensedClaimLevel} (${CLAIM_LADDER[licensedClaimLevel].verbClass}).`
    : 'Evidence licenses no claim level.';

  if (status === 'Supported') {
    return `Supported (coverage: ${band}). ${licenses}`;
  }
  return `Unverified. Requires ${missing.join(', ')} evidence; not obtained. ${licenses}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
