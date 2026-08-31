import type { HumanView } from '@uvrn/receipt';
import type { MetaReadout } from './types';

/**
 * Pure projection: HumanView → MetaReadout facts bag.
 * Does not invent drivers when actionableExplanation is missing.
 * Soft go ≠ buy — never emits buy/rank/opportunity ordering.
 */
export function readMetaReadout(view: HumanView): MetaReadout {
  const honestyFlags: string[] = [];

  if (!view.actionableExplanation) {
    honestyFlags.push('missing-actionable-explanation');
  }
  if (view.sourceQualityDiagnostics && view.sourceQualityDiagnostics.length > 0) {
    honestyFlags.push('weak-or-inconsistent-sources');
  }
  if (view.gaps.length > 0) {
    honestyFlags.push('gaps-present');
  }
  if (!view.provenance.signed) {
    honestyFlags.push('unsigned-provenance');
  }

  const readout: MetaReadout = {
    verdictLabel: view.verdictLabel,
    verdictTone: view.verdictTone,
    headline: view.headline,
    claim: view.claim,
    gaps: view.gaps.map((g) => ({ what: g.what, plainNote: g.plainNote })),
    honestyFlags,
    provenance: {
      signed: view.provenance.signed,
      hash: view.provenance.hash,
    },
  };

  if (view.stanceSummary !== undefined) {
    readout.linedUp = {
      support: view.stanceSummary.support,
      oppose: view.stanceSummary.oppose,
    };
  }

  if (view.verdictDescriptor !== undefined) {
    readout.verdictDescriptor = view.verdictDescriptor;
  }

  if (view.actionableExplanation !== undefined) {
    readout.situation = {
      question: view.actionableExplanation.question,
      primaryDrivers: view.actionableExplanation.primaryDrivers.map((d) => {
        const driver: {
          id: string;
          kind: string;
          anchor: string;
          fact: string;
          counterfactual?: string;
        } = {
          id: d.id,
          kind: d.kind,
          anchor: d.anchor,
          fact: d.fact,
        };
        if (d.counterfactual !== undefined) {
          driver.counterfactual = d.counterfactual;
        }
        return driver;
      }),
    };
  }

  if (view.sourceQualityDiagnostics && view.sourceQualityDiagnostics.length > 0) {
    readout.qualityDiagnostics = view.sourceQualityDiagnostics.map((d) => ({
      code: d.code,
      kind: d.kind,
      sourceId: d.sourceId,
      field: d.field,
      note: d.note,
    }));
  }

  if (view.scoreCard !== undefined) {
    readout.scoreCard = view.scoreCard;
  }

  return readout;
}
