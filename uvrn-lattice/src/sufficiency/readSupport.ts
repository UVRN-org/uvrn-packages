// Named host-facing support / sufficiency readout (BP-v2.1-Support).
// Chosen export name: `readSupport` (do not also ship `supportReadout`).
//
// Honest vocabulary: integrity-checked ≠ verified; support/sufficiency ≠ accuracy;
// V-Score ≠ accuracy. Never blends UVRN evidence state with agent confidence into one
// hashed receipt field.

import { verifyClaim } from './verifyClaim';
import type { ClaimInput, VerifyClaimOptions } from './verifyClaim';
import type { EvidenceInput } from './bridge';
import type { SufficiencyVerdict } from './types';

/**
 * Host-facing support readout shape. Same fields as `SufficiencyVerdict` — named for the
 * Support pillar so hosts do not confuse it with V-Score / agent confidence narratives.
 *
 * Status `Supported` means required evidence *classes* are present under declared sources —
 * not that the claim is verified, accurate, or a market outcome.
 */
export type SupportReadout = SufficiencyVerdict;

export type ReadSupportOptions = VerifyClaimOptions;

/**
 * Named support readout: grade host-declared evidence for a claim under origin-aware
 * sufficiency (distinct `originId` corroboration). Separate from any agent-confidence
 * narrative and from the V-Score.
 *
 * When inputs cannot support the claim species (missing required evidence classes, or
 * empty / untaggable evidence), returns an honest `Unverified` / empty-coverage readout —
 * never invents origins or claims verification.
 */
export function readSupport(
  claim: ClaimInput,
  evidence: EvidenceInput,
  options: ReadSupportOptions = {}
): SupportReadout {
  return verifyClaim(claim, evidence, options);
}
