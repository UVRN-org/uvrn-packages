import type { AnyRefusal } from './refusal';
import type { Thresholds } from './thresholds';

/** A computed probability with its band, all rounded to 6 decimals. */
export interface Candidate {
  p: number;
  low: number;
  high: number;
}

/** Combiner status of a candidate in `inputs[]` (SPEC §5.2). */
export type CandidateStatus = 'selected' | 'not-selected' | 'refused';

/** Evaluation context shared by the market and base-rate evaluators. */
export interface EvaluationContext {
  asOfMs: number;
  thresholds: Thresholds;
}

/** What an evaluator returns: a candidate (or null), its audit record, and its refusals. */
export interface Evaluation<TRecord> {
  candidate: Candidate | null;
  record: TRecord;
  refusals: AnyRefusal[];
}
