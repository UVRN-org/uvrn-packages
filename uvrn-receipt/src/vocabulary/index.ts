/**
 * The UVRN human vocabulary (Layer D, admin/plans/04-UX-LANGUAGE.md).
 * Single source of every human-facing string for measurement outcomes: packages, MCP output,
 * the uvrn.org portal, demos, and dashboards all speak through this module.
 * Protocol verdict names never change — this is a presentation layer mapped over them.
 * Strings are data (i18n-ready by structure) and host-overridable like everything in UVRN.
 */

import type { VerdictTone } from '../types';

/**
 * VerdictHuman is the human rendering of one protocol verdict.
 */
export interface VerdictHuman {
  /** Protocol verdict this entry maps (never shown as-is to end users). */
  verdict: string;
  /** Short human label, e.g. "Sources split — gap detected". */
  label: string;
  tone: VerdictTone;
  /** One-line meaning shown to the user. */
  meaning: string;
}

/** The D1 core vocabulary map, keyed by protocol verdict. */
export const VERDICT_VOCABULARY: Record<string, VerdictHuman> = {
  agree: {
    verdict: 'agree',
    label: 'Sources align',
    tone: 'aligned',
    meaning: 'Independent sources are telling the same story.',
  },
  disagree: {
    verdict: 'disagree',
    label: 'Sources split — gap detected',
    tone: 'split',
    meaning:
      'Sources point in different directions. A gap like this often marks something the crowd has not priced in yet.',
  },
  conflict: {
    verdict: 'conflict',
    label: 'Sources contradict',
    tone: 'contradiction',
    meaning: 'Sources directly contradict each other — at least one is wrong. Handle with care.',
  },
  potential: {
    verdict: 'potential',
    label: 'Early signal',
    tone: 'early-signal',
    meaning: 'Agreement is forming but has not settled. Worth watching.',
  },
  'insufficient-data': {
    verdict: 'insufficient-data',
    label: 'Not enough evidence',
    tone: 'insufficient',
    meaning: 'Too few usable sources to measure a relationship. Recorded honestly rather than guessed.',
  },
};

/** Non-firing / legacy v3 verdicts map to a quiet neutral entry per measurement type. */
const NON_FIRING: VerdictHuman = {
  verdict: 'none',
  label: 'No signal',
  tone: 'insufficient',
  meaning: 'This check ran and found nothing notable.',
};

/**
 * verdictHuman resolves any protocol verdict — current or legacy v3 (`none`, `no-agreement`) —
 * to its human rendering. Unknown verdicts come back as a recorded-not-hidden generic.
 */
export function verdictHuman(verdict: string): VerdictHuman {
  const entry = VERDICT_VOCABULARY[verdict];
  if (entry) return entry;
  if (verdict === 'none' || verdict === 'no-agreement') return NON_FIRING;
  return { verdict, label: verdict, tone: 'insufficient', meaning: `Outcome recorded as "${verdict}".` };
}

/**
 * FramingProfile supplies the domain-aware secondary line (D2). It affects the secondary line
 * only — never the verdict label.
 */
export type FramingProfileName = 'opportunity' | 'caution' | 'neutral';

/** Topic domain → framing profile (D2). Default is neutral. */
export const DOMAIN_FRAMING: Record<string, FramingProfileName> = {
  markets: 'opportunity',
  products: 'opportunity',
  news: 'caution',
  claims: 'caution',
  research: 'neutral',
};

/** Secondary lines per profile, keyed by tone. Only tones with domain-specific copy appear. */
export const FRAMING_LINES: Record<FramingProfileName, Partial<Record<VerdictTone, string>>> = {
  opportunity: {
    split:
      'Demand and supply data disagree here — that mismatch is the opportunity. High search interest with weak sales coverage means an underserved niche.',
    'early-signal': 'Momentum is building before the crowd has settled. Early is where the edge is.',
  },
  caution: {
    split: 'Coverage is divided. Read more than one source before concluding.',
    contradiction: 'At least one widely repeated account is wrong. Verify before sharing.',
  },
  neutral: {
    split: 'Findings diverge across sources — a live question, not settled science.',
  },
};

/**
 * framingFor returns the secondary line for a tone in a topic domain, or '' when the profile
 * has nothing extra to say (the D1 meaning already stands alone).
 */
export function framingFor(topicDomain: string | undefined, tone: VerdictTone): string {
  const profile = DOMAIN_FRAMING[topicDomain ?? ''] ?? 'neutral';
  return FRAMING_LINES[profile][tone] ?? '';
}

/**
 * The D3 explainer shown wherever a divergence-driven result ranks first.
 */
export const WHY_DIVERGENCE_WINS = {
  title: 'Why is a disagreement the top result?',
  body:
    'UVRN measures whether independent sources agree. When they align, the world already knows. ' +
    'When they split — high interest in one dataset, low coverage in another — that gap is where ' +
    'unnoticed opportunities live. The receipt does not tell you the gap is good or bad; it proves ' +
    'the gap exists, shows you exactly which sources diverge, and lets you verify it. Reading the ' +
    'gap is your edge.',
} as const;

/** The compact legend used on demo and portal surfaces (D3). */
export const VERDICT_LEGEND =
  'Aligned = confirmed · Split = opportunity/tension · Contradiction = warning · Early signal = watch';

/**
 * D4 plain-language meanings for the V-Score and its components. The V-Score line carries the
 * honesty rule: it scores evidence quality, never truth.
 */
export const SCORE_PLAIN_MEANING = {
  completeness: 'How many of the sources we asked actually answered.',
  parity: 'How closely the answering sources agree with each other.',
  freshness: 'How recent the evidence is.',
  vScore:
    'A 0–100 blend of the three. It scores the evidence quality, not whether the claim is true.',
} as const;

/** Status notes for source rows, including the explicit-gap framing (B5). */
export const SOURCE_STATUS_NOTES: Record<string, string> = {
  on: 'Responded and contributed evidence.',
  off: 'Switched off for this run — recorded, not hidden.',
  unavailable: 'Unreachable when asked — this lowers completeness; it is not hidden.',
};

/**
 * buildMasterNarrative renders the D1-vocabulary narrative template for a master receipt:
 * "7 of 8 sources align; 1 was unreachable." Producers use it as the default `narrative`.
 */
export function buildMasterNarrative(args: {
  claimText: string;
  primaryVerdict: string;
  sourcesTotal: number;
  sourcesResponded: number;
}): string {
  const human = verdictHuman(args.primaryVerdict);
  const gaps = args.sourcesTotal - args.sourcesResponded;
  const gapNote = gaps > 0 ? ` ${gaps} of ${args.sourcesTotal} source${args.sourcesTotal === 1 ? '' : 's'} ${gaps === 1 ? 'was' : 'were'} unreachable — recorded, not hidden.` : '';
  const headline = `${human.label}: ${args.sourcesResponded} of ${args.sourcesTotal} sources weighed in on "${args.claimText}".`;
  return truncateNarrative(`${headline} ${human.meaning}${gapNote}`);
}

function truncateNarrative(text: string): string {
  return text.length <= 500 ? text : `${text.slice(0, 497)}...`;
}

/**
 * enrichMeasurements stamps `humanExplanation` (Layer D) onto measurement results.
 * Call it BEFORE buildMasterReceipt so the human language is inside the hashed envelope
 * (B5.2) — enriching after hashing would invalidate the masterHash. Existing
 * humanExplanation values are preserved; inputs are not mutated.
 */
export function enrichMeasurements<
  T extends { verdict: string; humanExplanation?: string }
>(measurements: ReadonlyArray<T>): T[] {
  return measurements.map((measurement) => {
    if (measurement.humanExplanation !== undefined) return { ...measurement };
    const human = verdictHuman(measurement.verdict);
    return { ...measurement, humanExplanation: `${human.label}. ${human.meaning}` };
  });
}
