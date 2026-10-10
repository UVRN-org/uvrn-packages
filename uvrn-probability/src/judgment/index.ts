/**
 * @uvrn/probability/judgment — structural validation for attributed judgment forecasts
 * (SPEC/uvrn-probability-v2.md §5). Use `runForecast` with `mode: 'judgment'` to produce a
 * receipted record; this subpath exposes the validator and types for hosts that pre-check input.
 * A judgment is an attributed opinion: acceptance validates structure, never accuracy.
 */

export { MILLIONTHS, toMillionths, validateJudgment } from './validate';
export type {
  AbstentionRecord,
  JudgmentAbstention,
  JudgmentAssumption,
  JudgmentBasisLabel,
  JudgmentEvidence,
  JudgmentInput,
  JudgmentRecord,
  ValidatedJudgment,
} from './validate';
