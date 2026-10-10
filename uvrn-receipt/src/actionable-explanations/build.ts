/**
 * Build actionable disagree→agree explanations (BP-v2.1-LATER-D3).
 *
 * Grounded in measurement/receipt facts (+ optional D2 diagnostics / spread facts).
 * No invented ranking or weight product law.
 */

import type { HumanGap, HumanMeasurement, VerdictTone } from '../types';
import type { SourceQualityDiagnostic } from '../source-quality';
import type {
  ActionableExplanation,
  SplitDriver,
  SpreadDriverFactInput,
} from './types';

export interface BuildActionableExplanationArgs {
  measurements: readonly HumanMeasurement[];
  verdictTone: VerdictTone;
  stanceSummary?: { support: number; oppose: number };
  sourceQualityDiagnostics?: readonly SourceQualityDiagnostic[];
  gaps?: readonly HumanGap[];
  /** Optional host-supplied spread facts (non-hashed). */
  spreadDriverFacts?: readonly SpreadDriverFactInput[];
}

const AGREE_BELOW =
  /score\s+(\d+(?:\.\d+)?)\s+is\s+below\s+threshold\s+(\d+(?:\.\d+)?)/i;
const AGREE_AT =
  /agreement\s+score\s+(\d+(?:\.\d+)?)\s+at\s+threshold\s+(\d+(?:\.\d+)?)/i;
const DISAGREE_ABOVE =
  /diverge(?:s|d)?\s+by\s+(\d+(?:\.\d+)?),\s+above\s+threshold\s+(\d+(?:\.\d+)?)/i;
const DISAGREE_BELOW =
  /spread\s+(\d+(?:\.\d+)?)\s+does\s+not\s+exceed\s+disagreement\s+threshold\s+(\d+(?:\.\d+)?)/i;

const OVERSTATEMENT =
  /\b(high(?:ly)?\s+confiden(?:t|ce)|certain(?:ly)?|proven|verified\b|definitive|guaranteed|buy\s+now|act\s+now)\b/i;

function needsExplanation(args: BuildActionableExplanationArgs): boolean {
  if (args.verdictTone === 'split' || args.verdictTone === 'contradiction') return true;
  return args.measurements.some(
    (m) =>
      (m.type === 'disagree' && m.verdict === 'disagree') ||
      (m.type === 'agree' && m.verdict === 'no-agreement')
  );
}

function parseAgree(text: string): { score: number; threshold: number } | undefined {
  const below = AGREE_BELOW.exec(text);
  if (below) return { score: Number(below[1]), threshold: Number(below[2]) };
  const at = AGREE_AT.exec(text);
  if (at) return { score: Number(at[1]), threshold: Number(at[2]) };
  return undefined;
}

function parseDisagree(text: string): { spread: number; threshold: number } | undefined {
  const above = DISAGREE_ABOVE.exec(text);
  if (above) return { spread: Number(above[1]), threshold: Number(above[2]) };
  const below = DISAGREE_BELOW.exec(text);
  if (below) return { spread: Number(below[1]), threshold: Number(below[2]) };
  return undefined;
}

function pushClean(drivers: SplitDriver[], driver: SplitDriver): void {
  const blob = `${driver.fact} ${driver.counterfactual ?? ''}`;
  if (OVERSTATEMENT.test(blob)) {
    throw new Error(`actionable explanation overstatement blocked: ${blob}`);
  }
  drivers.push(driver);
}

/**
 * Build a render-only actionable explanation, or undefined when there is
 * no disagree/split signal to explain.
 */
export function buildActionableExplanation(
  args: BuildActionableExplanationArgs
): ActionableExplanation | undefined {
  if (!needsExplanation(args)) return undefined;

  const drivers: SplitDriver[] = [];

  for (const m of args.measurements) {
    if (m.type === 'disagree' && m.verdict === 'disagree') {
      const parsed = parseDisagree(m.plainExplanation);
      const fact =
        parsed !== undefined
          ? `The numbers are far enough apart (${parsed.spread}) that this reads as a disagreement.`
          : m.plainExplanation;
      const counterfactual =
        parsed !== undefined
          ? `They'd need to sit much closer together (about ${parsed.threshold} apart or less) before that disagreement label goes away.`
          : undefined;
      pushClean(drivers, {
        id: 'measurement.disagree',
        kind: 'measurement',
        anchor: 'measurements[disagree].explanation',
        fact,
        ...(counterfactual !== undefined ? { counterfactual } : {}),
      });
    }
    if (m.type === 'agree' && m.verdict === 'no-agreement') {
      const parsed = parseAgree(m.plainExplanation);
      const fact =
        parsed !== undefined
          ? `Sources aren't lined up yet — agreement is only about ${parsed.score}, short of what counts as agree.`
          : m.plainExplanation;
      const counterfactual =
        parsed !== undefined
          ? `They'd need to get closer — at least to about ${parsed.threshold} — before this counts as agreement.`
          : undefined;
      pushClean(drivers, {
        id: 'measurement.agree.no-agreement',
        kind: 'measurement',
        anchor: 'measurements[agree].explanation',
        fact,
        ...(counterfactual !== undefined ? { counterfactual } : {}),
      });
    }
  }

  if (
    args.stanceSummary !== undefined &&
    args.stanceSummary.support > 0 &&
    args.stanceSummary.oppose > 0
  ) {
    pushClean(drivers, {
      id: 'stance.split',
      kind: 'stance',
      anchor: 'payload.stanceSummary',
      fact: `There's a real split in stance: ${args.stanceSummary.support} lean support, ${args.stanceSummary.oppose} lean oppose.`,
      counterfactual:
        "If those stance leans shifted with real evidence behind them, the stance picture would change — that alone still wouldn't invent a new agreement score.",
    });
  }

  if (args.sourceQualityDiagnostics !== undefined) {
    for (const d of args.sourceQualityDiagnostics) {
      pushClean(drivers, {
        id: `source-quality.${d.code}.${d.sourceId}`,
        kind: 'source-quality',
        anchor: `sourceQualityDiagnostics[${d.code}]`,
        fact: `One source isn't carrying much: ${d.note}`,
        counterfactual:
          'If that source\'s declared input were stronger, this weak-spot flag would clear. Clearing it alone does not flip agree or disagree.',
      });
    }
  }

  if (args.spreadDriverFacts !== undefined) {
    for (const s of args.spreadDriverFacts) {
      pushClean(drivers, {
        id: s.id.startsWith('spread.') ? s.id : `spread.${s.id}`,
        kind: 'spread',
        anchor: s.anchor,
        fact: s.fact,
        ...(s.counterfactual !== undefined ? { counterfactual: s.counterfactual } : {}),
      });
    }
  }

  if (args.gaps !== undefined) {
    for (const g of args.gaps) {
      if (!/unreachable|switched off/i.test(g.what)) continue;
      // Skip D2-mirrored gaps (already covered via sourceQualityDiagnostics).
      if (/^Source-quality\b/i.test(g.what)) continue;
      pushClean(drivers, {
        id: `gap.${g.what}`,
        kind: 'gap',
        anchor: 'humanView.gaps',
        fact: `We're missing a voice in the mix: ${g.what}. ${g.plainNote}`,
        counterfactual:
          'If those missing sources had shown up with comparable numbers, the agree/disagree picture could change.',
      });
    }
  }

  if (drivers.length === 0) return undefined;

  return {
    question: 'disagree-to-agree',
    primaryDrivers: drivers,
  };
}
