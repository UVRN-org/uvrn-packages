import { DefaultEvidenceTagger } from './DefaultEvidenceTagger';
import { RuleBasedClaimClassifier } from './RuleBasedClaimClassifier';
import { matchSufficiency } from './matcher';
import { normalizeEvidence } from './bridge';
import type { EvidenceInput } from './bridge';
import type {
  AsyncClaimClassifier,
  ClaimClassifier,
  ClaimSpec,
  EvidenceTagger,
  SufficiencyVerdict,
} from './types';

export type ClaimInput = string | ClaimSpec;

export interface VerifyClaimOptions {
  classifier?: ClaimClassifier;
  tagger?: EvidenceTagger;
  claimSpec?: ClaimSpec; // pre-classified claim; skips the classifier
  claimId?: string;
  ts?: string;
}

function isClaimSpec(claim: ClaimInput): claim is ClaimSpec {
  return typeof claim !== 'string';
}

function applyClaimId(spec: ClaimSpec, claimId?: string): ClaimSpec {
  const resolved = claimId ?? spec.claimId;
  return resolved ? { ...spec, claimId: resolved } : spec;
}

// Standalone, zero-external claim sufficiency check. Classify the claim onto the ladder, tag
// the evidence, and match. This is the primary entry point — it runs fully in-process without
// a lattice run.
export function verifyClaim(
  claim: ClaimInput,
  evidence: EvidenceInput,
  options: VerifyClaimOptions = {}
): SufficiencyVerdict {
  const tagger = options.tagger ?? new DefaultEvidenceTagger();
  const classifier = options.classifier ?? new RuleBasedClaimClassifier();

  const baseSpec = options.claimSpec ?? (isClaimSpec(claim) ? claim : classifier.classify(claim));
  const claimSpec = applyClaimId(baseSpec, options.claimId);

  const items = normalizeEvidence(evidence, tagger);
  return matchSufficiency(claimSpec, items, { ts: options.ts });
}

// Async sibling for LLM-driven classifiers (AsyncClaimClassifier). Evidence tagging stays
// in-process; only claim classification is awaited.
export async function verifyClaimAsync(
  claim: ClaimInput,
  evidence: EvidenceInput,
  options: { classifier: AsyncClaimClassifier } & Omit<VerifyClaimOptions, 'classifier'>
): Promise<SufficiencyVerdict> {
  const tagger = options.tagger ?? new DefaultEvidenceTagger();

  const baseSpec =
    options.claimSpec ?? (isClaimSpec(claim) ? claim : await options.classifier.classify(claim));
  const claimSpec = applyClaimId(baseSpec, options.claimId);

  const items = normalizeEvidence(evidence, tagger);
  return matchSufficiency(claimSpec, items, { ts: options.ts });
}
