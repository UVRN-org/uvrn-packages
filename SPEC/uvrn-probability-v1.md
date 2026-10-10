# UVRN Probability Specification v1 (`uvrn-probability-v1`)

**Status:** Normative (draft, pre-publish) · **Date:** 2026-09-26 · **Generation:** v2.1
**Companion specs:** `uvrn-outcome-v1.md` (question identity) · `uvrn-receipt-v1.md` (canonicalization, hash law, envelope) · `uvrn-signing-v1.md` (Ed25519) · `uvrn-typed-observation-v1.md` (UCUM, `quantityKind`, obs status)
**Reference implementation:** `@uvrn/probability` 0.1.0 (this monorepo; not published). The package name is confirmed; from 0.2.0 this contract is served by the legacy `runProbability` compatibility emitter, which keeps the 0.1.0 origin so these vectors stay reproducible.
**Successor:** `uvrn-probability-v2.md` (caller-selected mode, standalone question, judgment). This document and its hash contract are unchanged.
**Schemas:** `SPEC/schemas/uvrn-probability-input-1.schema.json`, `SPEC/schemas/uvrn-probability-result-1.schema.json`
**Golden vectors:** `SPEC/vectors/probability-v1.json`

This document defines how UVRN turns **cited market prices** and **cited reference-class base rates**
into a deterministic, receipted probability for a declared outcome — and how it **refuses** when
the inputs do not support a number. Any implementation that follows this document reproduces the
golden vectors byte-for-byte.

The words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used in the RFC 2119 sense.

---

## 1. Design law

1. **Additive only.** Nothing here changes `drvc3-delta-1`, `uvrn-master-1`, `drvc3-receipt-1`,
   `uvrn-receipt-4`, or `uvrn-outcome-1`. This spec adds its own declared-field-list hash
   (`uvrn-probability-1`, §5.3) and wraps it in an ordinary `uvrn-receipt-4` NetworkReceipt.
2. **Cited inputs only.** Every number that enters a computation MUST carry a citation (§3.1).
   An implementation MUST NOT fetch, infer, or default a price, a case, or a date.
3. **Refuse rather than guess.** When an input is missing, stale, thin, inconsistent, or below a
   gate, the implementation MUST emit a typed refusal (§6) and MUST NOT emit a number from that
   candidate.
4. **No clock, no randomness.** An implementation MUST NOT read the system clock or a random
   source while computing. The evaluation instant is the explicit, cited `asOf` input (§3.2).
   Resampling methods (bootstrap) are therefore excluded.
5. **Probability is not a V-Score.** A probability MUST NOT be written to, labeled as, averaged
   with, or presented as a V-Score or any evidence-quality measure. They share no field.
6. **The output is an observation.** It carries `origin: "model:@uvrn/probability@<version>"` and
   is a *forecast* (`obsStatus: 'F'`) under `uvrn-typed-observation-v1`. It MUST NOT be pooled
   with measured observations (typed-observation §6.1 rule 2).
7. **v1 does not blend or adjust.** v1 selects one candidate by precedence (§5.2). It MUST NOT
   average candidates, apply bias corrections, or apply analyst adjustments. Those are deferred
   until a track record shows calibration.

---

## 2. Question identity

Every run references exactly one `uvrn-outcome-1` declaration by its `outcomeHash`
(`uvrn-outcome-v1.md` §3). This spec defines no new question shape. `outcomeHash` MUST match
`^sha256:[0-9a-f]{64}$`. An implementation MUST refuse to produce any output (throw an input
error, §6.1) when `outcomeHash` is missing or malformed, because the result could not be bound
to a question.

The producer is responsible for mapping the declared prediction onto `market.targetOutcome` or
onto the base-rate target event. That mapping is recorded in `inputs[]` and is auditable, but it
is not verified by this spec.

---

## 3. Input (`uvrn-probability-input-1`)

### 3.1 Citations

```
Citation { url: string /* http(s) */, accessedAt: ZonedTimestamp, label?: string }
```

A citation is REQUIRED on: `asOf`, every market, every market outcome (quote), every reference
class, every criterion, every case, and the time-to-event subject. A missing or malformed
citation MUST produce `missing_citation`. Only the declared members (`url`, `accessedAt`,
`label`) are echoed into outputs; unknown members MUST NOT be echoed.

### 3.2 Timestamps

- `ZonedTimestamp`: ISO 8601 with an explicit zone — `Z` or `±hh:mm`. REQUIRED for `asOf.at`,
  every `quotedAt`, and every `accessedAt`.
- `DateOrZoned`: a `ZonedTimestamp` **or** a calendar date `YYYY-MM-DD`, which MUST be
  interpreted as `00:00:00Z` of that date. Permitted for `resolvesAt`, case `filedAt`,
  `statusAt`, `resolvedAt`, `subject.filedAt`, and `horizon.by`, because sources publish these as
  dates.
- `asOf.at` without a zone MUST produce an input error (§6.1): the run cannot be placed in time.
- Output `asOf` is `asOf.at` normalized to UTC, `YYYY-MM-DDTHH:mm:ss.sssZ`. The original string
  is echoed in `inputs[]` (role `asOf`).
- Durations in days are `(ms_b − ms_a) / 86 400 000` with no rounding before use.

### 3.3 Shape

```
{
  specVersion: 'uvrn-probability-input-1',
  outcome:  { outcomeHash },
  asOf:     { at: ZonedTimestamp, source: Citation },
  market?:  Market,               // §4.1–4.3
  baserate?: ProportionBaseRate | TimeToEventBaseRate,   // §4.4–4.6
  thresholds?: Partial<Thresholds> // §7; overrides are recorded, never silent
}
```

The JSON Schema is normative for structure. Semantic checks (staleness, gates, counts) are
refusals, not schema errors.

---

## 4. Methods

### 4.1 Implied probability (sportsbook)

| Format | Input | Implied probability q |
|---|---|---|
| American | `value` = A, \|A\| ≥ 100 | A > 0: `100/(A+100)`; A < 0: `−A/(−A+100)` |
| Decimal | `value` = d > 1 | `1/d` |
| Fractional | `numerator` n > 0, `denominator` m > 0 | `m/(n+m)` |

A quote whose computed q is not strictly inside (0, 1) MUST produce `market_invalid_odds`.
A sportsbook market MUST list ≥ 2 mutually exclusive, exhaustive outcomes.

### 4.2 De-vig

Let `B = Σ q_i` and overround `B − 1`. If `B − 1 < 0` or `B − 1 > maxSportsbookOverround`, the
market MUST be refused with `market_overround_out_of_range`.

Three methods are computed on every sportsbook market:

- **Multiplicative:** `p_i = q_i / B`.
- **Power (DEFAULT):** find `k ≥ 1` with `Σ q_i^k = 1`; `p_i = q_i^k`.
- **Shin** (Shin 1993, parameterized per Jullien & Salanié 1994):
  `p_i(z) = (√(z² + 4(1−z)·q_i²/B) − z) / (2(1−z))`; find `z ∈ [0, 0.99]` with `Σ p_i(z) = 1`.
  When `B = 1`, `z = 0` and `p_i = q_i`. For two outcomes Shin equals additive de-vig
  `p_i = q_i − (B−1)/2` (conformance check).

**Solver (normative, for determinism).** Power: bracket `[1, hi]` with `hi` starting at 2 and
doubling while `Σ q^hi − 1 > 0` (at most 64 doublings, else refuse). Shin: bracket `[0, 0.99]`;
if `g(0.99) ≥ 0`, refuse. Then run exactly `DEVIG_ITERATIONS = 200` bisection steps
(`mid = (lo+hi)/2`; move `lo` when the function at `mid` is > 0, else move `hi`), take
`(lo+hi)/2`, and require `|residual| ≤ DEVIG_TOLERANCE = 1e-9`; otherwise refuse with
`devig_nonconvergence`.

**Band.** For the target outcome: `p = power`, `low = min(multiplicative, power, Shin)`,
`high = max(...)`. The method spread `high − low` is recorded. Method choice uncertainty is shown,
not hidden. (Clarke, Kovalchik & Ingram 2017 found power best or tied and multiplicative worst;
no method is universally best, so all three are reported.)

### 4.3 Exchange

Exchange outcomes carry `bid`, `ask` in probability units (`0 ≤ bid ≤ ask ≤ 1`; a 41¢ contract is
`0.41`) and `depthUsd`, the cited USD notional resting at best bid plus best ask.

- One outcome (binary YES contract): `p = (bid+ask)/2`, `low = bid`, `high = ask`.
- ≥ 2 exclusive outcomes: midpoints `m_i` are normalized, `p = m_t / Σ m`, `low = bid_t / Σ m`,
  `high = ask_t / Σ m` (each clamped to [0, 1]; the band is widened to contain `p`).
- On the target contract: `ask − bid > maxExchangeSpread` → `market_spread_too_wide`;
  `depthUsd < minExchangeDepthUsd` → `market_depth_too_thin`.

**Labeling (normative).** Every market record MUST carry `priceLabel: 'market-implied'` and
`biasCorrection: 'none'`. Exchange prices show documented favorite-longshot and long-horizon
biases; v1 MUST NOT correct them (a correction is a tuning knob). The record MUST carry `venue`,
`domain`, and `timeToResolutionDays` so a track record can measure the bias later.

**Staleness (all markets).** For each quote: `quotedAt > asOf` → `market_quote_after_asof`;
`asOf − quotedAt > maxQuoteStalenessMs` → `market_quote_stale`. `resolvesAt ≤ asOf` →
`market_resolves_before_asof`. `targetOutcome` not among the labels → `market_target_not_found`.

### 4.4 Proportion base rate (Jeffreys)

After the similarity gate (§4.6), let `x` = included cases with `outcome: 'yes'`, `n` = included
cases. Each case's `resolvedAt` MUST be ≤ `asOf` (else `baserate_event_after_asof`).

- Point estimate: posterior mean `(x + 1/2) / (n + 1)` (never exactly 0 or 1).
- Interval: equal-tailed quantiles of `Beta(x + 1/2, n − x + 1/2)` at `α/2` and `1 − α/2`,
  `α = 1 − CONFIDENCE_LEVEL = 0.05`.
- Boundary rule (Brown, Cai & DasGupta 2001): `low = 0` when `x = 0`; `high = 1` when `x = n`.

**Incomplete beta (normative).** `I_x(a,b)` uses ln Γ by the Lanczos approximation (g = 7, the
standard 9 coefficients) and the modified-Lentz continued fraction with exactly
`BETA_CF_ITERATIONS = 300` terms (no early exit), using the symmetry
`I_x(a,b) = 1 − I_{1−x}(b,a)` when `x ≥ (a+1)/(a+b+2)`. The inverse is bisection on [0, 1] for
exactly `BETA_INV_ITERATIONS = 200` steps. If the final continued-fraction term differs from 1 by
≥ 1e-14 in any evaluation, the run MUST refuse with `baserate_nonconvergence`.

### 4.5 Time-to-event base rate (Aalen-Johansen, competing risks)

Target event: `approved`. Competing events: `denied`, `withdrawn` — they make approval
impossible and MUST NOT be treated as censored. Censored: `pending` only, censored at its
`statusAt` (the last-checked date). For each included case, `time = statusAt − filedAt` in days;
`statusAt < filedAt` → `baserate_invalid_case`; `statusAt > asOf` → `baserate_event_after_asof`.

**4.5.1 Estimator.** At each distinct time `t_j` with ≥ 1 event: `n_j` = cases with
`time ≥ t_j` (a case censored at `t_j` is at risk at `t_j`), `d1_j` approvals, `d2_j` competing,
`d_j = d1_j + d2_j`. With overall event-free survival `S` (all event types):

```
F_1(t) = Σ_{t_j ≤ t} S(t_{j−1}) · d1_j / n_j        S(t_j) = S(t_{j−1}) · (1 − d_j / n_j)
```

**4.5.2 Conditional form.** The subject has been pending since `subject.filedAt`. Let
`a = asOf − subject.filedAt` and `D = horizon.by − subject.filedAt` (days). Then

```
P(approved by D | pending at a) = (F_1(D) − F_1(a)) / S(a)
```

computed equivalently as the same estimator over rows with `a < t_j ≤ D`, with `S` taken relative
to `S(a)`. Rules:
- `D ≤ a` → `baserate_horizon_not_after_elapsed`.
- No case with `time > a`, or `S(a) = 0` → `baserate_no_risk_set_at_elapsed`.
- `D` greater than the largest observed time while relative survival there is > 0 (some case was
  still unresolved at the end of follow-up) → `baserate_horizon_beyond_followup`. When every case
  had resolved (`S = 0` at the last time), the estimate beyond it is exact and allowed.

**4.5.3 Variance and interval.** Delta method on per-time multinomial hazards (Choudhury 2002),
with `S_{j−1}` the relative survival before row j, `F_j` the running estimate after row j, and `F`
the final estimate:

```
Var = Σ S_{j−1}² · d1_j (n_j − d1_j) / n_j³
    + Σ (F − F_j)² · d_j / (n_j (n_j − d_j))
    − 2 Σ (F − F_j) · S_{j−1} · d1_j / n_j²
```

Terms with `F − F_j = 0` are skipped. Interval on the log(−log) scale:
`w = z·se / (F·|ln F|)`, `low = F^{e^w}`, `high = F^{e^{−w}}`, `z = Z_975 = 1.959963984540054`.
When `F ∈ {0, 1}` or `se = 0` the transform is undefined: the implementation MUST fall back to the
Jeffreys interval (§4.4) with `n` = cases at risk after `a` and `x = round(F·n)`, keep
`p = F`, widen the band to contain `p`, and record `interval: 'jeffreys-degenerate-fallback'`.

**4.5.4 Naive KM (diagnostic only).** `1 − KM` with competing events treated as censored
overstates the approval probability; the error grows with time and with how common competing
events are. It MUST NOT be used as the estimate. The golden vectors include a worked case
(`unit.aalenJohansenVsNaiveKm`: 0.58 naive vs 0.44 Aalen-Johansen).

### 4.6 Similarity gate (declared criteria)

A reference class is a cited list of criteria (`id`, `text`, `source`). Each case cites the
criterion ids it meets (`meetsCriteria`). A case is **included** only when it cites **every**
declared criterion; otherwise it is **excluded** and listed with its missing criteria. A case
citing an undeclared id MUST produce `baserate_unknown_criterion`. If included cases `< minCases`,
the base rate MUST be refused with `baserate_below_min_cases`. No computed similarity score is
permitted: it would be an unaudited knob. Malformed cases MUST be refused
(`baserate_invalid_case`), never silently dropped.

---

## 5. Combiner and output

### 5.1 Rounding

Every computed number in the output (p, low, high, candidate values, de-vig arrays, overround,
spread, standard error, days, hours, survival, CIF) MUST be rounded with exactly
`Math.round(x * 1e6) / 1e6` (negative zero normalized to 0) **before** canonicalization. Input
echoes (odds, bid, ask, depthUsd) are reproduced as given.

### 5.2 Precedence

1. Every supplied candidate (market, base rate) is evaluated and its record appended to `inputs[]`.
2. If any **input-scope** refusal exists (`invalid_input`, `missing_citation` on `asOf`,
   `no_candidate`), `method = 'insufficient_basis'`.
3. Else if the market produced a candidate (no market refusals) → `method = 'market'`.
4. Else if the base rate produced a candidate → `method = 'baserate'`.
5. Else `method = 'insufficient_basis'`; `p`, `low`, `high` are `null`.

Candidate records carry `status`: `selected`, `not-selected` (usable but lower precedence), or
`refused`. `inputs[]` order is fixed: `asOf`, `thresholds`, `market` (if supplied), `baserate`
(if supplied). `refusals[]` order: input, then market, then base rate, each in evaluation order.
An `insufficient_basis` result MUST carry ≥ 1 refusal.

### 5.3 `uvrn-probability-1` — the probability hash

- **Encoding:** `prefixed` (`sha256:` + 64 lowercase hex).
- **Canonicalization:** `uvrn-jcs-1` via `@uvrn/receipt/canonical` `canonicalize()`.
- **Payload:** exactly this closed field list:

```
{ specVersion: 'uvrn-probability-1', origin, outcomeHash, asOf, method, p, low, high, inputs, refusals }
```

- All ten fields are REQUIRED (null values are hashed as `null`). Any other member — including
  `probabilityHash`, `source`, `receipt` — is NOT hashed. Hash-covered additions require a new
  `specVersion`.

### 5.4 Receipt

The result is wrapped in a `uvrn-receipt-4` NetworkReceipt, built with `@uvrn/receipt`
primitives (`computeNetworkReceiptHash`, `claimIdFromText`, `signReceipt`):

```
kind: 'probability', source: '@uvrn/probability', action: 'probability.run',
occurredAt: asOf, claim: { id: claimIdFromText(text), text: 'Probability for uvrn-outcome-1 declaration <outcomeHash>' },
payload: { ...hashPayload, probabilityHash }, tags: ['probability', 'method:<method>'], narrative
```

Signing is OPTIONAL and uses a caller-supplied Ed25519 key and optional caller-supplied
`signedAt` (`uvrn-signing-v1` §2). Private key material MUST NOT appear in any output.
Verification = `uvrn-probability-1` recompute + `verifyReceiptFull`.

### 5.5 Output and typed-observation projection

```
{ specVersion, origin, outcomeHash, asOf, method, p, low, high, inputs[], refusals[],
  probabilityHash, receipt,
  source: { value: p, unit: '1', quantityKind: 'probability', origin, measuredAt: asOf,
            obsStatus: 'F', codeLists: { ucum: 'ucum-2.1', clObsStatus: 'sdmx-2.1/CL_OBS_STATUS' },
            receiptHash } | null }
```

`unit` is the UCUM unity `"1"` (typed-observation §2: no parallel unit vocabularies; not
`"prob"`). `source` is `null` for `insufficient_basis`. Downstream desks that use a different
unit string map it themselves and SHOULD keep the `receiptHash` reference.

---

## 6. Refusals

### 6.1 Input errors (no output)

Only two conditions prevent any output: a malformed `outcomeHash` and an `asOf.at` that is not a
zoned timestamp. Implementations MUST raise a typed input error. Everything else is a refusal.

### 6.2 Refusal codes (closed list for v1)

Shape: `{ code, scope: 'input' | 'market' | 'baserate', message }`. `message` is observation
language only.

| Code | Scope | Meaning |
|---|---|---|
| `invalid_input` | any | Structurally invalid member (wrong specVersion, bad threshold, missing field) |
| `missing_citation` | any | A required citation is missing or malformed (§3.1) |
| `no_candidate` | input | Neither market nor base rate supplied, or none produced a number |
| `market_invalid_odds` | market | Odds/bid/ask not valid, or implied probability not in (0,1) |
| `market_target_not_found` | market | `targetOutcome` is not a listed outcome |
| `market_quote_after_asof` | market | A quote is timestamped after `asOf` |
| `market_quote_stale` | market | A quote is older than `maxQuoteStalenessMs` at `asOf` |
| `market_resolves_before_asof` | market | The market resolves at or before `asOf` |
| `market_overround_out_of_range` | market | Overround < 0 or > `maxSportsbookOverround` |
| `market_spread_too_wide` | market | Target spread > `maxExchangeSpread` |
| `market_depth_too_thin` | market | Target depth < `minExchangeDepthUsd` |
| `devig_nonconvergence` | market | Power or Shin could not bracket or did not meet tolerance |
| `baserate_unknown_criterion` | baserate | A case cites an undeclared criterion |
| `baserate_invalid_case` | baserate | A case is malformed (status, dates, ids) |
| `baserate_event_after_asof` | baserate | A case outcome/status is dated after `asOf` |
| `baserate_below_min_cases` | baserate | Fewer than `minCases` cases pass the gate |
| `baserate_no_risk_set_at_elapsed` | baserate | No reference case was still pending at the subject's elapsed time |
| `baserate_horizon_not_after_elapsed` | baserate | Horizon is not after `asOf` |
| `baserate_horizon_beyond_followup` | baserate | Horizon is outside the observed follow-up while cases were unresolved |
| `baserate_nonconvergence` | baserate | Incomplete-beta evaluation did not converge |

---

## 7. Thresholds

**PROVISIONAL — not decided by the package owner.** These defaults are implementer placeholders.
They are exported as named constants, may be overridden per run, and the effective values are
always recorded in `inputs[]` (role `thresholds`, `provisional: true`, `overridden: [...]`).

| Constant | Default | Status |
|---|---|---|
| `MIN_CASES` | 8 | PROVISIONAL |
| `MAX_QUOTE_STALENESS_MS` | 86 400 000 (24 h) | PROVISIONAL |
| `MAX_EXCHANGE_SPREAD` | 0.05 | PROVISIONAL |
| `MIN_EXCHANGE_DEPTH_USD` | 1000 | PROVISIONAL |
| `MAX_SPORTSBOOK_OVERROUND` | 0.5 (wide: futures books carry 20–40%) | PROVISIONAL |
| `CONFIDENCE_LEVEL` | 0.95 | pinned |
| `DEVIG_ITERATIONS` / `DEVIG_TOLERANCE` | 200 / 1e-9 | pinned |
| `BETA_CF_ITERATIONS` / `BETA_INV_ITERATIONS` | 300 / 200 | pinned |

Changing a PROVISIONAL default changes golden vectors that depend on it; that is a spec change.

---

## 8. Golden vectors

`SPEC/vectors/probability-v1.json` holds synthetic fixtures (example.org citations — not
research). Each case gives the input, optional signer (the SPEC test key from
`network-receipt.json`), and expected `method`, `p`, `low`, `high`, refusal codes,
`probabilityHash`, `receiptHash`, signature (when signed), and `canonicalResultSha256` =
SHA-256 of JCS of the entire result (byte identity). Required coverage: sportsbook two-way and
multi-outcome, exchange binary and multi-outcome, stale refusal, stale-market fallback to base
rate, market-over-base-rate precedence, small n, x = 0, x = n, censored + competing events,
conditional, below-minCases refusal, horizon-beyond-follow-up refusal, no candidate, and a signed
receipt. Unit vectors pin implied-probability conversion, Jeffreys values (cross-checked against
independent quadrature), and the naive-KM overstatement example.

An implementation is conformant when it reproduces every vector. Existing receipt vectors are
unaffected.

---

## 9. Determinism and platform

Same input (and same signer) MUST produce byte-identical canonical output. The algorithms above
use only IEEE-754 double arithmetic, `Math.sqrt`, `Math.pow`, `Math.log`, `Math.exp`. V8's
`Math.log`/`Math.exp`/`Math.pow` are stable across platforms (fdlibm-derived), but ECMAScript does
not guarantee bit-identical transcendental functions across engines. This spec therefore pins the
reference platform as **Node.js LTS on V8**; the golden vectors (after 6-decimal rounding) are the
conformance oracle for other platforms.

---

## 10. Honest vocabulary and limits

| Term | May be used when |
|---|---|
| **integrity-checked** | `uvrn-probability-1` and `receiptHash` recompute |
| **verified** | integrity-checked AND the producer signature verifies (`uvrn-signing-v1`) |
| **market-implied** | the selected method is `market`; never "calibrated" or "true probability" |
| **base rate** | the selected method is `baserate` over a declared, cited reference class |
| **calibrated** | reserved for a resolved track record showing it (not produced by this spec) |

Limits that copy and docs MUST state:
- A receipt proves integrity and who produced the record. It does **not** prove accuracy.
- A self-declared `declaredAt` / `asOf` does not prove the forecast existed before the outcome.
  External anchoring (e.g. OpenTimestamps) is future work.
- A clean record requires logging **every** output, including refusals and `insufficient_basis`.

---

## 11. Track-record data contract

`@uvrn/track-record` gains no import from this package. The link is data only:
- A forecast log entry carries `originId` (= `origin`), `forecastId`, `outcomeHash`, `method`,
  `refused`, and the probability (binary `forecastP`, or a multi-class distribution), plus the
  `receiptHash`. Implementations SHOULD log every run, including refusals.
- Multi-outcome questions use Brier's original multi-class score
  `Σ_k (p_k − o_k)²` (range 0–2) with `scoringRule: 'brier-multi'`. It MUST NOT be averaged with
  the binary `brier` score (range 0–1; equal to half of `brier-multi` on a two-outcome question).
- Reliability bins for multi-class forecasts use one-vs-rest per class.

---

## 12. Out of scope (v1)

Blending, analyst adjustments, favorite-longshot or horizon bias correction, fuzzy similarity,
bootstrap intervals, external timestamp anchoring, ClearMarket resolution grades as an input, and
any real-world vectors (arrive with M5 real use).
