// Forecast modes: market (de-vigged odds / exchange mid), baserate (Jeffreys), judgment (agent allocation).
// Market + baserate math is ported from @uvrn/probability; judgment validation follows its AGENT-GUIDE.
// A refusal is a first-class result: no number is produced instead of guessing one.
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
import { impliedProbability, overround, devigMultiplicative, devigPower, devigShin, exchangeMid, normalizeToOne, round6, clamp01 } from './odds.mjs';
import { jeffreysInterval } from './beta.mjs';

// PROVISIONAL thresholds (inherited from @uvrn/probability; the package owner has not finalized them).
export const THRESHOLDS = Object.freeze({
  minCases: 8,
  maxQuoteStalenessMs: 24 * 60 * 60 * 1000,
  maxExchangeSpread: 0.05,
  minExchangeDepthUsd: 1000,
  maxSportsbookOverround: 0.5,
});
const hasCitation = (c) => c && typeof c.url === 'string' && c.url.length > 0 && typeof c.accessedAt === 'string' && !Number.isNaN(Date.parse(c.accessedAt));
const ms = (s) => Date.parse(s);

export function marketForecast(m, asOf, overrides = {}) {
  const T = { ...THRESHOLDS, ...overrides };
  const refusals = [];
  const refuse = (code, message) => refusals.push({ code, message });
  const errors = [];
  if (!m || !Array.isArray(m.outcomes) || m.outcomes.length < 2 && m.kind === 'sportsbook') errors.push('market.outcomes must list every outcome (sportsbook needs ≥ 2)');
  if (!hasCitation(m?.source)) errors.push('market.source needs url + accessedAt (cite only what you actually read)');
  if (!m?.targetOutcome) errors.push('market.targetOutcome is required');
  const targetIndex = errors.length ? -1 : m.outcomes.findIndex((o) => o.label === m.targetOutcome);
  if (!errors.length && targetIndex < 0) errors.push(`targetOutcome "${m.targetOutcome}" is not one of the listed outcomes`);
  if (errors.length) return { method: 'market', status: 'invalid', errors };
  const asOfMs = ms(asOf);
  for (const o of m.outcomes) {
    if (!o.quotedAt || Number.isNaN(ms(o.quotedAt))) { errors.push(`outcome "${o.label}" needs quotedAt`); continue; }
    if (ms(o.quotedAt) > asOfMs) refuse('market_quote_after_asof', `quote for "${o.label}" is after asOf`);
    else if (asOfMs - ms(o.quotedAt) > T.maxQuoteStalenessMs) refuse('market_quote_stale', `quote for "${o.label}" is older than ${T.maxQuoteStalenessMs / 3600000}h at asOf`);
  }
  if (errors.length) return { method: 'market', status: 'invalid', errors };
  if (m.resolvesAt) {
    const endOfDay = /^\d{4}-\d{2}-\d{2}$/.test(m.resolvesAt) ? ms(m.resolvesAt + 'T23:59:59.999Z') : ms(m.resolvesAt);
    if (endOfDay < asOfMs) refuse('market_resolves_before_asof', 'market resolves before asOf');
  }
  let candidate = null; const detail = { kind: m.kind, venue: m.venue ?? '', priceLabel: 'market-implied (not a UVRN estimate)', biasCorrection: 'none' };
  if (m.kind === 'sportsbook') {
    const implied = m.outcomes.map((o) => impliedProbability(o.odds));
    if (implied.some((q) => q === null)) refuse('market_invalid_odds', 'one or more quoted prices are invalid');
    else {
      const over = overround(implied);
      const mult = devigMultiplicative(implied);
      detail.overround = round6(over);
      if (over < 0 || over > T.maxSportsbookOverround) refuse('market_overround_out_of_range', `overround ${round6(over)} is outside [0, ${T.maxSportsbookOverround}]`);
      else {
        const pw = devigPower(implied), sh = devigShin(implied);
        if (!pw.ok) refuse('devig_nonconvergence', pw.reason);
        if (!sh.ok) refuse('devig_nonconvergence', sh.reason);
        if (pw.ok && sh.ok) {
          const vals = [mult[targetIndex], pw.probabilities[targetIndex], sh.probabilities[targetIndex]];
          candidate = { p: round6(pw.probabilities[targetIndex]), low: round6(Math.min(...vals)), high: round6(Math.max(...vals)) };
          detail.defaultMethod = 'power';
          detail.methodSpread = round6(Math.max(...vals) - Math.min(...vals));
          detail.byMethod = { multiplicative: round6(mult[targetIndex]), power: round6(pw.probabilities[targetIndex]), shin: round6(sh.probabilities[targetIndex]) };
          detail.allOutcomes = m.outcomes.map((o, i) => ({ label: o.label, p: round6(pw.probabilities[i]) }));
        }
      }
    }
  } else if (m.kind === 'exchange') {
    const bids = m.outcomes.map((o) => o.bid), asks = m.outcomes.map((o) => o.ask), depths = m.outcomes.map((o) => o.depthUsd);
    if (![...bids, ...asks, ...depths].every((v) => typeof v === 'number' && Number.isFinite(v)) || bids.some((b, i) => b < 0 || asks[i] > 1 || b > asks[i])) {
      refuse('market_invalid_odds', 'exchange outcomes need bid ≤ ask in [0,1] and depthUsd');
    } else {
      const bid = bids[targetIndex], ask = asks[targetIndex], spread = ask - bid, depth = depths[targetIndex];
      if (spread > T.maxExchangeSpread) refuse('market_spread_too_wide', `spread ${round6(spread)} exceeds ${T.maxExchangeSpread}`);
      if (depth < T.minExchangeDepthUsd) refuse('market_depth_too_thin', `depth $${depth} is below $${T.minExchangeDepthUsd}`);
      const mids = bids.map((b, i) => exchangeMid(b, asks[i]));
      let p = mids[targetIndex], low = bid, high = ask;
      if (mids.length > 1) {
        const tot = mids.reduce((a, b) => a + b, 0);
        if (!(tot > 0)) refuse('market_invalid_odds', 'exchange midpoints sum to zero; cannot normalize');
        else { p = normalizeToOne(mids)[targetIndex]; low = clamp01(bid / tot); high = clamp01(ask / tot); }
      }
      detail.spread = round6(spread); detail.depthUsd = depth;
      candidate = { p: round6(p), low: round6(Math.min(low, p)), high: round6(Math.max(high, p)) };
    }
  } else return { method: 'market', status: 'invalid', errors: ['market.kind must be "sportsbook" or "exchange"'] };
  if (refusals.length) candidate = null;
  return candidate ? { method: 'market', status: 'ok', ...candidate, bandKind: m.kind === 'sportsbook' ? 'method-spread' : 'bid-ask', detail, refusals: [] }
                   : { method: 'market', status: 'refused', p: null, low: null, high: null, detail, refusals };
}

export function baseRateForecast(b, overrides = {}) {
  const T = { ...THRESHOLDS, ...overrides };
  const errors = [];
  if (!b?.referenceClass?.description) errors.push('baserate.referenceClass.description is required');
  if (!hasCitation(b?.referenceClass?.source)) errors.push('baserate.referenceClass.source needs url + accessedAt');
  if (!Number.isInteger(b?.x) || !Number.isInteger(b?.n) || b.n < 0 || b.x < 0 || b.x > b.n) errors.push('baserate needs integers 0 ≤ x ≤ n (x = cases with the outcome, n = comparable cases)');
  if (errors.length) return { method: 'baserate', status: 'invalid', errors };
  if (b.n < T.minCases) return { method: 'baserate', status: 'refused', p: null, low: null, high: null, refusals: [{ code: 'baserate_below_min_cases', message: `${b.n} comparable cases is below the minimum ${T.minCases}` }], detail: { x: b.x, n: b.n } };
  const j = jeffreysInterval(b.x, b.n);
  if (!j.converged) return { method: 'baserate', status: 'refused', p: null, low: null, high: null, refusals: [{ code: 'baserate_nonconvergence', message: 'interval did not converge' }], detail: { x: b.x, n: b.n } };
  return { method: 'baserate', status: 'ok', p: round6(j.p), low: round6(j.low), high: round6(j.high), bandKind: 'jeffreys-95', refusals: [],
    detail: { x: b.x, n: b.n, referenceClass: b.referenceClass.description, pointEstimate: 'posterior-mean', note: 'Only as good as the claim that the cases are comparable.' } };
}

export function judgmentForecast(j) {
  const errors = [];
  if (j?.abstain) return { method: 'judgment', status: 'refused', p: null, refusals: [{ code: 'judgment_abstained', message: j.rationale || 'abstained: insufficient basis' }], detail: {} };
  if (!Array.isArray(j?.outcomes) || j.outcomes.length < 2) errors.push('judgment.outcomes needs ≥ 2 {id,p} entries');
  else {
    for (const o of j.outcomes) if (typeof o.p !== 'number' || !(o.p >= 0 && o.p <= 1) || Math.abs(o.p * 1e6 - Math.round(o.p * 1e6)) > 1e-6) errors.push(`outcome "${o.id}": p must be in [0,1] with ≤ 6 decimals`);
    const total = j.outcomes.reduce((a, o) => a + o.p, 0);
    if (Math.abs(total - 1) > 1e-9) errors.push(`probabilities sum to ${total}, not exactly 1 (never rescaled)`);
  }
  if (!j?.rationale) errors.push('judgment.rationale is required');
  if (!Array.isArray(j?.counterarguments) || !j.counterarguments.length) errors.push('judgment.counterarguments needs at least one credible counterargument');
  if (errors.length) return { method: 'judgment', status: 'invalid', errors };
  const evidence = (j.evidence ?? []).filter(hasCitation);
  const basis = evidence.length ? 'evidence-backed' : 'assumption-only';
  return { method: 'judgment', status: 'ok', outcomes: j.outcomes.map((o) => ({ id: o.id, p: o.p })), p: j.outcomes[0].p, low: null, high: null, bandKind: 'none', refusals: [],
    detail: { label: 'agent judgment (not a market price, not a measured rate)', basis, evidenceCount: evidence.length, assumptions: j.assumptions ?? [], rationale: j.rationale, counterarguments: j.counterarguments, uncertainty: j.uncertainty ?? '' } };
}

/** request: { forecastId, question:{text,resolveBy,resolutionRule,outcomes?}, asOf, mode, market|baserate|judgment, thresholds? } */
export function runForecast(req) {
  const errors = [];
  if (!req?.forecastId) errors.push('forecastId is required (you supply it; reuse only to retry the identical request)');
  if (!req?.question?.text || !req?.question?.resolveBy || !req?.question?.resolutionRule) errors.push('question needs text, resolveBy and resolutionRule');
  if (!req?.asOf || Number.isNaN(Date.parse(req.asOf))) errors.push('asOf must be an explicit timestamp (never backdate)');
  if (!['market', 'baserate', 'judgment'].includes(req?.mode)) errors.push('mode must be exactly one of market | baserate | judgment (no automatic blending)');
  if (errors.length) return { specVersion: 'uvrn-skills-forecast-1', status: 'invalid', errors };
  let r;
  if (req.mode === 'market') r = marketForecast(req.market, req.asOf, req.thresholds);
  else if (req.mode === 'baserate') r = baseRateForecast(req.baserate, req.thresholds);
  else r = judgmentForecast(req.judgment);
  return { specVersion: 'uvrn-skills-forecast-1', forecastId: req.forecastId, asOf: req.asOf, question: req.question, mode: req.mode, targetLabel: req.market?.targetOutcome ?? req.question.targetLabel ?? null, ...r,
    notAReceipt: 'UVRN-style estimate. Not a signed UVRN receipt; no hash contract applies.' };
}
