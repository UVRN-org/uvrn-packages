import type { DomainSignal } from '../types';
import { DefaultEvidenceTagger } from './DefaultEvidenceTagger';
import type { EvidenceItem, EvidenceTagger, TaggableEvidence } from './types';

export type EvidenceInput = EvidenceItem[] | TaggableEvidence[] | DomainSignal[];

// Discriminator precedence: an already-classified EvidenceItem (has `evidenceClass`) is taken
// as-is before the DomainSignal check, so a well-formed item is never re-bridged. Callers are
// expected to pass one homogeneous evidence shape per call.
function isEvidenceItem(item: unknown): item is EvidenceItem {
  return typeof item === 'object' && item !== null && 'evidenceClass' in item;
}

function isDomainSignal(item: unknown): item is DomainSignal {
  return typeof item === 'object' && item !== null && 'domainId' in item;
}

// Bridge lattice DomainSignals into taggable evidence and classify them. The signal `value`
// is intentionally dropped: it is a 0..100 consensus metric, not an evidence-strength signal,
// so feeding it into coverage scoring would skew the verdict by V-Score magnitude. Bridged
// items therefore fall back to the matcher's neutral strength.
//
// Note: lattice signal sources are URIs like `mock://...` or `delegate://...`, which the
// default taxonomy does not recognize. Integrated runs that need a real verdict should pass
// provenance evidence explicitly (LatticeOptions.evidence) or supply a custom tagger.
export function bridgeFromDomainSignals(
  signals: DomainSignal[],
  tagger: EvidenceTagger = new DefaultEvidenceTagger()
): EvidenceItem[] {
  return signals
    .map((signal) =>
      tagger.tag({
        source: signal.source,
        ...(typeof signal.originId === 'string' && signal.originId.trim().length > 0
          ? { originId: signal.originId.trim() }
          : {}),
        key: signal.key,
        ts: signal.ts,
        explanation: signal.explanation,
      })
    )
    .filter((item): item is EvidenceItem => item !== null);
}

// Normalize any accepted evidence input into tagged EvidenceItem[]. EvidenceItems pass
// through; DomainSignals are bridged; raw TaggableEvidence is tagged. Untaggable entries are
// dropped.
export function normalizeEvidence(
  evidence: EvidenceInput,
  tagger: EvidenceTagger = new DefaultEvidenceTagger()
): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  for (const entry of evidence) {
    if (isEvidenceItem(entry)) {
      items.push(entry);
    } else if (isDomainSignal(entry)) {
      items.push(...bridgeFromDomainSignals([entry], tagger));
    } else {
      const tagged = tagger.tag(entry as TaggableEvidence);
      if (tagged) {
        items.push(tagged);
      }
    }
  }

  return items;
}
