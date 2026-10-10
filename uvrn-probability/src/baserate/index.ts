/**
 * @uvrn/probability/baserate — reference-class base rates (SPEC §4.4–4.6).
 */

export {
  inverseRegularizedIncompleteBeta,
  lnGamma,
  regularizedIncompleteBeta,
} from './beta';
export type { BetaValue } from './beta';
export { jeffreysInterval } from './jeffreys';
export type { JeffreysResult } from './jeffreys';
export {
  conditionalCumulativeIncidence,
  logLogInterval,
  oneMinusKaplanMeier,
  riskTable,
} from './aalen-johansen';
export type { ConditionalIncidence, EventType, Observation, RiskRow } from './aalen-johansen';
export { evaluateBaseRate } from './evaluate';
export type {
  BaseRateInput,
  BaseRateInputRecord,
  CaseStatus,
  Criterion,
  ProportionBaseRateInput,
  ProportionCase,
  ReferenceClass,
  TimeToEventBaseRateInput,
  TimeToEventCase,
} from './evaluate';
