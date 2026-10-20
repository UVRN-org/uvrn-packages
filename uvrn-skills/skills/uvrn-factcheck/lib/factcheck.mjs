// Fact-check / cross-reference engine: independent sources → origin-aware agreement → V-Score → measurements,
// plus the agent's own self-checks reported SEPARATELY (never blended into the score).
// Honest vocabulary (UVRN law): "cross-referenced", never "verified". A hash/score alone proves nothing about truth.
// Derived from UVRN (Apache-2.0) — Built on UVRN. See ../NOTICE.
import { analyzeSources } from './consensus.mjs';
import { scoreBreakdown, applyDecay, SCORE_PROFILES, WEIGHTS } from './score.mjs';
import { measureAll } from './measure.mjs';

const CHECK_RESULTS = ['pass', 'fail', 'unresolved'];

export function summarizeChecks(checks = []) {
  const bad = checks.filter((c) => !CHECK_RESULTS.includes(c.result)).map((c) => c.id ?? c.question);
  const count = (r) => checks.filter((c) => c.result === r).length;
  return { total: checks.length, pass: count('pass'), fail: count('fail'), unresolved: count('unresolved'), invalid: bad,
    failed: checks.filter((c) => c.result === 'fail'), unresolvedList: checks.filter((c) => c.result === 'unresolved') };
}

/**
 * input: { claim, profile?, evaluatedAt, sources[], checks?[], history?[], decay?{curve,rate,ageHours},
 *          weights?, dedup?, freshnessWindowDays? }
 */
export function runFactCheck(input) {
  const errors = [];
  if (!input?.claim) errors.push('claim is required');
  if (!Array.isArray(input?.sources)) errors.push('sources must be an array');
  if (!input?.evaluatedAt || Number.isNaN(Date.parse(input.evaluatedAt))) errors.push('evaluatedAt must be an explicit timestamp');
  if (errors.length) return { kind: 'factcheck', specVersion: 'uvrn-skills-factcheck-1', status: 'invalid', errors };

  const profileName = SCORE_PROFILES[input.profile] ? input.profile : 'general';
  const analysis = analyzeSources(input.sources, { fetchedAt: input.evaluatedAt, weights: input.weights, dedup: input.dedup, freshnessWindowDays: input.freshnessWindowDays });
  const checks = summarizeChecks(input.checks);
  const warnings = [];
  if (analysis.inferredPublishTimestampCount > 0) warnings.push(`${analysis.inferredPublishTimestampCount} source(s) have no declared publish date; freshness is scored 0 for any source without a declared measuredAt.`);
  if (analysis.unusableSourceCount > 0) warnings.push(`${analysis.unusableSourceCount} of ${analysis.inputCount} sources had no usable ${analysis.basis.startsWith('numeric') ? 'numeric value' : 'assertion'} and lowered completeness.`);
  if (analysis.excludedForecastCount > 0) warnings.push(`${analysis.excludedForecastCount} forecast-type source(s) were excluded: forecasts are not evidence of what happened.`);
  if (analysis.distinctOriginCount < analysis.observationSourceCount) warnings.push(`${analysis.observationSourceCount} sources trace to only ${analysis.distinctOriginCount} independent origin(s); repeated reporting of one origin counts once.`);
  if (checks.invalid.length) warnings.push(`Self-checks with invalid result values were ignored: ${checks.invalid.join(', ')}.`);

  const base = { kind: 'factcheck', specVersion: 'uvrn-skills-factcheck-1', claim: input.claim, evaluatedAt: input.evaluatedAt, profile: profileName, basis: analysis.basis,
    sources: analysis.ranked, counts: { input: analysis.inputCount, usable: analysis.usableCount, independent: analysis.independentCount, retained: analysis.retainedCount, distinctOrigins: analysis.distinctOriginCount, deduplicated: analysis.deduplicatedCount },
    selfChecks: checks, warnings,
    notAReceipt: 'UVRN-style cross-reference. Not a signed UVRN receipt. "Cross-referenced" means independent sources were compared — not that the claim is proven true.' };

  if (analysis.insufficientIndependentSources) {
    return { ...base, status: 'insufficient-independent-sources', insufficientIndependentSources: analysis.insufficientIndependentSources,
      headline: 'Not enough independent sources to cross-reference this claim.', score: null, measures: null,
      absoluteConsensusValue: analysis.absoluteConsensusValue };
  }

  let components = { ...analysis.components };
  let decay = null;
  if (input.decay) {
    const decayed = applyDecay(input.decay.curve, components.freshness, input.decay.ageHours, input.decay.rate);
    decay = { curve: input.decay.curve, rate: input.decay.rate, ageHours: input.decay.ageHours, freshnessBefore: components.freshness, freshnessAfter: decayed, note: 'Decay applies to the Freshness component only; Completeness and Parity are unchanged.' };
    components = { ...components, freshness: decayed };
  }
  const score = scoreBreakdown(components, profileName);

  const numeric = analysis.basis.startsWith('numeric');
  const mSources = analysis.ranked.map((r) => numeric
    ? { id: r.id, label: r.title, kind: 'numeric', value: r.value }
    : { id: r.id, label: r.title, kind: 'categorical', assertion: r.assertion });
  const measures = measureAll({ claim: input.claim, sources: mSources, context: { history: input.history } });

  // Parity counts distinct origins (pre-dedup), grouped by identical value/assertion — report exactly that.
  const clusterList = analysis.originClusters;
  const topCluster = clusterList[0], originTotal = analysis.distinctOriginCount;
  const parityPhrase = `${topCluster.origins.length} of ${originTotal} independent origin${originTotal === 1 ? '' : 's'} report the same ${numeric ? 'value' : 'position'} (${topCluster.key})`;
  const verdict = measures.conflict.verdict === 'conflict' ? 'conflict'
    : measures.agree.verdict === 'agree' ? 'agree' : measures.disagree.verdict === 'disagree' ? 'disagree' : 'mixed';
  const headline = verdict === 'agree' ? `Independent sources agree — ${parityPhrase}.`
    : verdict === 'conflict' ? `Sources conflict — ${parityPhrase}; dissenting: ${clusterList.slice(1).map((c) => `${c.origins.length} said “${c.key}”`).join(', ') || 'see measurements'}.`
    : verdict === 'disagree' ? `Sources disagree — ${measures.disagree.explanation} ${parityPhrase}.` : `Sources do not clearly agree or conflict — ${parityPhrase}.`;
  const caution = checks.fail > 0 ? `${checks.fail} of the agent's own self-check(s) failed — treat this result with caution.` : null;

  return { ...base, status: 'ok', verdict, headline, caution, score, decay, clusters: clusterList, measures,
    absoluteConsensusValue: analysis.absoluteConsensusValue, weights: WEIGHTS };
}
