/**
 * Agent/human judgment (SPEC/uvrn-probability-v2.md §5): a validated, attributed allocation with
 * its evidence or labeled assumptions, rationale, counterarguments, and uncertainty. The package
 * checks structure and arithmetic only; it never normalizes, adjusts, or validates accuracy.
 */

import type { Citation } from '../common/citation';
import {
  expectArray,
  expectCitation,
  expectRecord,
  expectText,
  fail,
  isPlainRecord,
} from '../common/strict';
import type { QuestionRecord } from '../forecast/question';

export const MILLIONTHS = 1_000_000;

export interface JudgmentEvidence {
  id: string;
  statement: string;
  source: Citation;
}

export interface JudgmentAssumption {
  id: string;
  /** An explicitly speculative premise. */
  statement: string;
}

export interface JudgmentInput {
  /** Exactly one entry per question outcome; each p in [0, 1] with at most six decimals; sum = 1 exactly. */
  probabilities: Array<{ outcomeId: string; p: number }>;
  evidence?: JudgmentEvidence[];
  assumptions?: JudgmentAssumption[];
  rationale: string;
  counterarguments: string[];
  uncertainty: string;
  /** Binary only, for YES: a subjective plausible range, never a statistical confidence interval. */
  range?: { low: number; high: number; rationale: string };
}

export interface JudgmentAbstention {
  abstain: true;
  reason: string;
}

export type JudgmentBasisLabel = 'assumption-only' | 'cited-evidence-and-judgment';

export interface JudgmentRecord {
  basisLabel: JudgmentBasisLabel;
  evidence: JudgmentEvidence[];
  assumptions: JudgmentAssumption[];
  rationale: string;
  counterarguments: string[];
  uncertainty: string;
  range: { low: number; high: number; rationale: string } | null;
}

export interface AbstentionRecord {
  abstain: true;
  reason: string;
}

export type ValidatedJudgment =
  | { kind: 'allocation'; record: JudgmentRecord; probabilities: Array<{ outcomeId: string; p: number }> }
  | { kind: 'abstention'; record: AbstentionRecord };

/** A number in [0, 1] with at most six decimal places. */
function expectProbability(value: unknown, path: string, code: 'invalid_distribution' | 'invalid_range'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(code, path, 'must be a finite number');
  if (value < 0 || value > 1) fail(code, path, 'must be in [0, 1]');
  if (Math.round(value * MILLIONTHS) / MILLIONTHS !== value) fail(code, path, 'must have at most six decimal places');
  return value;
}

/** Integer millionths of an already six-decimal probability. */
export function toMillionths(p: number): number {
  return Math.round(p * MILLIONTHS);
}

function uniqueIds(items: Array<{ id: string }>, path: string, seen: Set<string>): void {
  items.forEach((item, i) => {
    if (seen.has(item.id)) fail('invalid_judgment', `${path}[${i}].id`, 'duplicates another evidence or assumption id');
    seen.add(item.id);
  });
}

/**
 * validateJudgment returns an allocation (in question outcome order) or an abstention, or throws
 * a typed ForecastValidationError. Judgment needs evidence OR labeled assumptions; an
 * assumption-only estimate is accepted and labeled `assumption-only`.
 */
export function validateJudgment(value: unknown, question: QuestionRecord): ValidatedJudgment {
  if (isPlainRecord(value) && 'abstain' in value) {
    const a = expectRecord(value, 'judgment', ['abstain', 'reason']);
    if (a.abstain !== true) fail('invalid_judgment', 'judgment.abstain', 'must be true when present');
    return { kind: 'abstention', record: { abstain: true, reason: expectText(a.reason, 'judgment.reason', 'invalid_judgment') } };
  }

  const j = expectRecord(
    value,
    'judgment',
    ['probabilities', 'rationale', 'counterarguments', 'uncertainty'],
    ['evidence', 'assumptions', 'range']
  );

  const evidence: JudgmentEvidence[] = (j.evidence === undefined ? [] : expectArray(j.evidence, 'judgment.evidence')).map(
    (raw, i) => {
      const path = `judgment.evidence[${i}]`;
      const e = expectRecord(raw, path, ['id', 'statement', 'source']);
      return {
        id: expectText(e.id, `${path}.id`, 'invalid_judgment'),
        statement: expectText(e.statement, `${path}.statement`, 'invalid_judgment'),
        source: expectCitation(e.source, `${path}.source`),
      };
    }
  );
  const assumptions: JudgmentAssumption[] = (
    j.assumptions === undefined ? [] : expectArray(j.assumptions, 'judgment.assumptions')
  ).map((raw, i) => {
    const path = `judgment.assumptions[${i}]`;
    const a = expectRecord(raw, path, ['id', 'statement']);
    return {
      id: expectText(a.id, `${path}.id`, 'invalid_judgment'),
      statement: expectText(a.statement, `${path}.statement`, 'invalid_judgment'),
    };
  });
  const seenIds = new Set<string>();
  uniqueIds(evidence, 'judgment.evidence', seenIds);
  uniqueIds(assumptions, 'judgment.assumptions', seenIds);
  if (evidence.length === 0 && assumptions.length === 0) {
    fail(
      'judgment_basis_missing',
      'judgment',
      'needs at least one evidence item or one explicitly labeled assumption; never invent a citation'
    );
  }

  const rationale = expectText(j.rationale, 'judgment.rationale', 'invalid_judgment');
  const counterarguments = expectArray(j.counterarguments, 'judgment.counterarguments', 1).map((c, i) =>
    expectText(c, `judgment.counterarguments[${i}]`, 'invalid_judgment')
  );
  const uncertainty = expectText(j.uncertainty, 'judgment.uncertainty', 'invalid_judgment');

  const rawProbs = expectArray(j.probabilities, 'judgment.probabilities');
  const byOutcome = new Map<string, number>();
  const declared = new Set(question.outcomes.map((o) => o.id));
  rawProbs.forEach((raw, i) => {
    const path = `judgment.probabilities[${i}]`;
    const e = expectRecord(raw, path, ['outcomeId', 'p']);
    const outcomeId = expectText(e.outcomeId, `${path}.outcomeId`, 'invalid_distribution');
    if (!declared.has(outcomeId)) fail('invalid_distribution', `${path}.outcomeId`, 'is not a question outcome id');
    if (byOutcome.has(outcomeId)) fail('invalid_distribution', `${path}.outcomeId`, 'is duplicated');
    byOutcome.set(outcomeId, expectProbability(e.p, `${path}.p`, 'invalid_distribution'));
  });
  if (byOutcome.size !== question.outcomes.length) {
    fail('invalid_distribution', 'judgment.probabilities', 'must list exactly one entry per question outcome');
  }
  const probabilities = question.outcomes.map((o) => ({ outcomeId: o.id, p: byOutcome.get(o.id) as number }));
  const sum = probabilities.reduce((acc, e) => acc + toMillionths(e.p), 0);
  if (sum !== MILLIONTHS) {
    fail('invalid_distribution', 'judgment.probabilities', 'must sum to exactly 1 (1,000,000 millionths); allocations are never normalized');
  }

  let range: JudgmentRecord['range'] = null;
  if (j.range !== undefined) {
    if (question.kind !== 'binary') fail('invalid_range', 'judgment.range', 'is allowed only for binary questions');
    const r = expectRecord(j.range, 'judgment.range', ['low', 'high', 'rationale']);
    const low = expectProbability(r.low, 'judgment.range.low', 'invalid_range');
    const high = expectProbability(r.high, 'judgment.range.high', 'invalid_range');
    const yes = probabilities[0].p;
    if (!(low < high)) fail('invalid_range', 'judgment.range', 'low must be below high; omit the range instead of a zero-width one');
    if (!(low <= yes && yes <= high)) fail('invalid_range', 'judgment.range', 'must enclose the YES probability');
    range = { low, high, rationale: expectText(r.rationale, 'judgment.range.rationale', 'invalid_range') };
  }

  return {
    kind: 'allocation',
    probabilities,
    record: {
      basisLabel: evidence.length === 0 ? 'assumption-only' : 'cited-evidence-and-judgment',
      evidence,
      assumptions,
      rationale,
      counterarguments,
      uncertainty,
      range,
    },
  };
}
