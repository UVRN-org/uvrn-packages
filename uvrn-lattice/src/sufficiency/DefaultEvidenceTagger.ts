import { EVIDENCE_TAXONOMY } from './ladder';
import type { EvidenceClass, EvidenceItem, EvidenceTagger, TaggableEvidence } from './types';

// Tags raw evidence with the EvidenceClass it is licensed to prove, using the domain-general
// keyword taxonomy. `overrides` lets users extend the vocabulary (e.g. crypto "TVL" ->
// market_expansion) without subclassing. Unrecognized sources return null.
export class DefaultEvidenceTagger implements EvidenceTagger {
  readonly name = 'DefaultEvidenceTagger';
  private readonly overrides: Array<{ match: string; evidenceClass: EvidenceClass }>;

  constructor(overrides?: Record<string, EvidenceClass>) {
    this.overrides = Object.entries(overrides ?? {}).map(([match, evidenceClass]) => ({
      match: match.toLowerCase(),
      evidenceClass,
    }));
  }

  tag(input: TaggableEvidence): EvidenceItem | null {
    const haystack = `${input.source} ${input.key ?? ''}`.toLowerCase();
    const rule =
      this.overrides.find((entry) => haystack.includes(entry.match)) ??
      EVIDENCE_TAXONOMY.find((entry) => haystack.includes(entry.match));

    if (!rule) {
      return null;
    }

    return {
      evidenceClass: rule.evidenceClass,
      source: input.source,
      key: input.key,
      value: input.value,
      ts: input.ts,
      explanation:
        input.explanation ??
        `Tagged ${input.source}${input.key ? ` (${input.key})` : ''} as ${rule.evidenceClass} evidence.`,
    };
  }
}
