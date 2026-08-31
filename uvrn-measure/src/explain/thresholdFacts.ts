/**
 * Threshold fact helpers (BP-v2.1-LATER-D3).
 *
 * Extract agreement / divergence facts already present in measurement results
 * (or their explanation strings). No new ranking policy — cites existing
 * agreeThreshold / divergenceThreshold values from starter measurement explanations.
 */

export interface MeasurementResultLike {
  type: string;
  verdict: string;
  explanation: string;
  confidence?: number;
}

export interface MeasurementThresholdFact {
  measurementType: 'agree' | 'disagree';
  verdict: string;
  /** Agreement score (agree) or numeric spread (disagree). */
  value: number;
  threshold: number;
  explanation: string;
  /**
   * Plain-language “what would move toward agree?” when derivable from these facts.
   * Never invents weights or ranking; only restates threshold gaps.
   */
  disagreeToAgreeHint?: string;
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
  /\b(high(?:ly)?\s+confiden(?:t|ce)|certain(?:ly)?|proven|verified\b|definitive|guaranteed)\b/i;

/** Parse score + threshold from an agree measurement explanation. */
export function parseAgreeExplanation(
  explanation: string
): { score: number; threshold: number } | undefined {
  const below = AGREE_BELOW.exec(explanation);
  if (below) {
    return { score: Number(below[1]), threshold: Number(below[2]) };
  }
  const at = AGREE_AT.exec(explanation);
  if (at) {
    return { score: Number(at[1]), threshold: Number(at[2]) };
  }
  return undefined;
}

/** Parse spread + threshold from a disagree measurement explanation. */
export function parseDisagreeExplanation(
  explanation: string
): { spread: number; threshold: number } | undefined {
  const above = DISAGREE_ABOVE.exec(explanation);
  if (above) {
    return { spread: Number(above[1]), threshold: Number(above[2]) };
  }
  const below = DISAGREE_BELOW.exec(explanation);
  if (below) {
    return { spread: Number(below[1]), threshold: Number(below[2]) };
  }
  return undefined;
}

function agreeHint(score: number, threshold: number, verdict: string): string | undefined {
  if (verdict === 'no-agreement' && score < threshold) {
    return `They'd need to get closer — at least to about ${threshold} — before this counts as agreement.`;
  }
  return undefined;
}

function disagreeHint(spread: number, threshold: number, verdict: string): string | undefined {
  if (verdict === 'disagree' && spread > threshold) {
    return `They'd need to sit much closer together (about ${threshold} apart or less) before that disagreement label goes away.`;
  }
  return undefined;
}

/**
 * Extract threshold facts from measurement results that already carry
 * agree/disagree explanations. Skips insufficient-data and unparseable rows.
 */
export function thresholdFactsFromResults(
  results: readonly MeasurementResultLike[]
): MeasurementThresholdFact[] {
  const out: MeasurementThresholdFact[] = [];
  for (const result of results) {
    if (result.type === 'agree') {
      const parsed = parseAgreeExplanation(result.explanation);
      if (!parsed) continue;
      const hint = agreeHint(parsed.score, parsed.threshold, result.verdict);
      const fact: MeasurementThresholdFact = {
        measurementType: 'agree',
        verdict: result.verdict,
        value: parsed.score,
        threshold: parsed.threshold,
        explanation: result.explanation,
        ...(hint !== undefined ? { disagreeToAgreeHint: hint } : {}),
      };
      assertNoOverstatement(fact);
      out.push(fact);
    } else if (result.type === 'disagree') {
      const parsed = parseDisagreeExplanation(result.explanation);
      if (!parsed) continue;
      const hint = disagreeHint(parsed.spread, parsed.threshold, result.verdict);
      const fact: MeasurementThresholdFact = {
        measurementType: 'disagree',
        verdict: result.verdict,
        value: parsed.spread,
        threshold: parsed.threshold,
        explanation: result.explanation,
        ...(hint !== undefined ? { disagreeToAgreeHint: hint } : {}),
      };
      assertNoOverstatement(fact);
      out.push(fact);
    }
  }
  return out;
}

/**
 * Pick the primary disagree→agree counterfactual from extracted facts.
 * Prefer agree no-agreement gap; else disagree spread gap. No ranking weights.
 */
export function primaryDisagreeToAgreeHint(
  facts: readonly MeasurementThresholdFact[]
): string | undefined {
  const agreeGap = facts.find(
    (f) => f.measurementType === 'agree' && f.verdict === 'no-agreement' && f.disagreeToAgreeHint
  );
  if (agreeGap?.disagreeToAgreeHint) return agreeGap.disagreeToAgreeHint;
  const disagreeGap = facts.find(
    (f) => f.measurementType === 'disagree' && f.verdict === 'disagree' && f.disagreeToAgreeHint
  );
  return disagreeGap?.disagreeToAgreeHint;
}

function assertNoOverstatement(fact: MeasurementThresholdFact): void {
  const blob = `${fact.explanation} ${fact.disagreeToAgreeHint ?? ''}`;
  if (OVERSTATEMENT.test(blob)) {
    throw new Error(`threshold fact overstatement blocked: ${blob}`);
  }
}
