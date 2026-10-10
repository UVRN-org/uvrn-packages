/**
 * @uvrn/probability/odds — market prices → market-implied probabilities (SPEC §4).
 */

export {
  DEFAULT_DEVIG_METHOD,
  devigMultiplicative,
  devigPower,
  devigShin,
  exchangeMid,
  impliedProbability,
  normalizeToOne,
  overround,
} from './math';
export type { DevigMethod, OddsValue, SolveResult } from './math';
export { evaluateMarket } from './market';
export type {
  ExchangeOutcome,
  MarketInput,
  MarketInputRecord,
  MarketOutcomeRecord,
  MarketPolicy,
  SportsbookOutcome,
} from './market';
