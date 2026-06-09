> **Provenance:** Mirrored from `UVRN-org/uvrn-home`
> (`docs/CLAIM-VERIFICATION-ENGINE-VISION.md`, branch `claude/uvrn-packages-planning-zwYrJ`) on
> 2026-06-02 for traceability of the `@uvrn/lattice` sufficiency build. Layer 1 of this vision
> was transcribed in lattice v0.4.0 — see
> [`../build-plans/BUILD-lattice-claim-sufficiency-1.md`](../build-plans/BUILD-lattice-claim-sufficiency-1.md).

---

# UVRN Claim-Verification Engine — Vision & Direction

> **Status:** Direction-setting design note. No code or pipeline changes implied by this
> document. It captures a working session so the ideas can later be transcribed into
> official **lattice** package abilities once the package repo
> (`uvrn-packages_builds_private_1`) has been reviewed.
>
> **Tagline (end-state):** *UVRN — The Stock Market for Information.*
> *Track claims, trends, and opportunities through evidence, not opinions.*

---

## 1. Context — the problem that started this

A third-party critique of a UVRN **POD Trends** report (the maximalism / dopamine-dressing
report, `pod-027` in this repo) scored it:

| Axis | Score |
|---|---|
| Signal Strength | 7.5 / 10 |
| Evidence Quality | 6.5 / 10 |
| Actionability for POD Sellers | 8.5 / 10 |
| **Academic / Research Rigor** | **4 / 10** |

The key insight: the trend was **real** and even independently corroborated (Printful's
2026 trend report and Pinterest Predicts 2026 both name it). So the low rigor score was
**not a content failure** — it was a **methodology failure**. Restated in one line:

> **The pipeline treats *prominence / trend-signal* as if it were *market performance*.**

Every weakness the critique raised collapses into that single confusion:

- Multiple sources observing the **same** cultural shift were counted as **independent**
  confirmation (correlated evidence scored as if separate datasets).
- "An Etsy category exists" was used as proof of **market size** (it only proves demand
  exists — not size, growth, or profitability).
- A **prominence score** was read as if it were revenue / conversion / saturation. A
  trend can have rising prominence while remaining a tiny niche.

What the report did **right** and what we want to preserve: it transparently flagged weak
sources (`Unknown source host — defaulted to T?`). That honesty is a credibility *asset*,
not a defect — any solution must extend it, never paper over it.

**The goal:** evolve UVRN from a **trend detector** into an **evidence-sufficiency
engine**, and ultimately into a public, evidence-weighted *record of claims about reality*.

---

## 2. Primary purpose — a living, self-correcting record

The reason this capability matters is **not** "better reports." It is to keep
**uvrn.org itself a living, self-correcting record**. The engine's first job is to ensure
that every published claim on the site stays continuously reconciled with new information
as it arrives. When fresh evidence shifts or flips a verdict, the **on-site content tied
to that claim is revised**, and the revision is logged on the public trail.

Two standing guarantees:

- **Honest** — never silently wrong. When evidence changes, the record changes, and the
  *why* is public (this is exactly what DRVC3 receipts already provide).
- **Up to date** — never stale. A page reflects what the evidence says *today*, not what
  it said the day it was first published.

The site thereby stops being a pile of timestamped articles and becomes **one
continuously maintained document**: *what we believe, what changed, and why* — maintained
by the evidence engine rather than by hand. **Corrections become a feature**, not an
embarrassment: a public revision / corrections history is the operational proof of
"evidence, not opinions."

This is why the **stable claim-ID primitive** (§5) is non-optional — it is the thread
linking a live claim to the content it governs, so a re-score knows exactly what to update.

---

## 3. The core reframe (Solution Part One)

Stop asking the evidence-first question and start asking the claim-first one:

| | Question |
|---|---|
| ❌ Evidence-first | "Do we have sales data?" |
| ✅ Claim-first | "What evidence would a reasonable person require before accepting **this specific claim**?" |

Evidence is graded **relative to the claim it is asked to support** — not on an absolute
strength scale. Three components:

### 3.1 The claim ladder (burden of proof rises with the claim's verb)

| Level | Claim says… | Evidence required |
|---|---|---|
| L1 | "people are talking about it" | social / search volume |
| L2 | "people are interested" | engagement, saves, clicks, search growth |
| L3 | "people are buying" | sales, marketplace velocity |
| L4 | "businesses are succeeding because of it" | profit, revenue growth, market share |
| L5 | "this is a durable market opportunity" | longitudinal performance, repeat purchase, cohort retention |

### 3.2 Evidence taxonomy — each source proves *one specific claim*

These are **different claims**, not weaker/stronger versions of one claim:

| Evidence | Proves |
|---|---|
| Pinterest / TikTok / Google Trends growth | people are *interested / talking / looking* |
| Etsy **listings** | *sellers* are entering |
| Etsy **sales** | people are *buying* |
| Amazon BSR | people are *repeatedly* buying |
| Revenue growth | the *market is expanding* |

### 3.3 The matcher → verdict

`Required Evidence Class` ∩ `Evidence Obtained` → **`Supported`** / **`Unverified`**
(+ a confidence read). The honest output is the one that declares its own limits:

```
CLAIM:     "Maximalism is entering mainstream POD"        CLAIM:    "Maximalist POD products outperform minimalism"
REQUIRES:  trend confirmation                             REQUIRES: sales performance
OBTAINED:  ✓ Pinterest ✓ Printful ✓ Etsy ✓ retail        OBTAINED: ✗ missing
STATUS:    Supported (confidence: moderate)               STATUS:   Unverified
```

The report wasn't wrong — it simply never declared *which claim* its evidence was
licensed to support. This layer makes that declaration mandatory, and **it dissolves all
four critique symptoms at their root rather than patching them individually.**

This is also **domain-general**: "Earth is warming" needs temperature records, not stock
data; "inflation is rising" needs CPI/PPI, not tweets; "AI adoption is accelerating" needs
usage/enterprise/revenue, not conference attendance. That generality is what makes it a
**lattice** ability rather than a POD-specific feature.

---

## 4. Accountability over time (Solution Part Two)

A claim stops being a one-shot verdict and becomes a **longitudinal record** carrying:
original statement → evidence + evidence class → confidence → *missing* evidence → later
results → trajectory (**strengthened / weakened / failed**). UVRN becomes a **public
claim-performance ledger**.

Two new signal types that each directly close one of the original wounds:

- **Saturation** (count of competing listings/designers) → answers *"prominence ≠ market
  size"* and tells a seller whether the **early-entry window is still open**.
- **Durability** (still growing at 30 / 60 / 90 days) → the longitudinal proof that
  separates a real move from a spike (the L5 "durable opportunity" rung, measured).

**Emergent superpower — source-reliability memory.** Once claims have outcomes, you can
backtest *which sources were leading indicators vs. noise*. Source weights become **earned
by track record**, not assumed — and two sources that always move together reveal
themselves as **one** signal, which fixes the independence problem at its root.

---

## 5. Claims as living assets (Solution Part Three)

The financial analogy, made precise: the stock market prices *what people think an asset
is worth*; UVRN prices *what evidence suggests a claim is becoming more or less true*.
Same machinery (live valuation, momentum, history), fundamentally different asset class —
**the asset is a claim about reality.**

Each claim gets:

- a **ticker symbol** (`MAXI-POD`, `AI-JOBS`, `ANTI-AI`),
- a **current confidence**, an ***Nd* change** (momentum), and **per-signal direction**
  (↑ / → / ↓),
- a **status lifecycle**: Emerging → Confirming → Mainstream (confidence-threshold bands
  that fuse §3's ladder with §4's trajectory),
- **volatility** as a first-class property — a steady 73 and a thrashing 73 are different
  assets,
- a place on the **source leaderboard** (historical accuracy % per source — the
  "which investors are good" analogy, on the evidence side),
- and a **history**, which yields the compounding moat: provable *earliness*
  ("detected six months before mainstream recognition").

```
MAXI-POD  ·  Confidence 73  ·  30d +12
  ↑ Pinterest   ↑ Etsy demand   ↑ Printful reports   → Amazon saturation
  Jun 2026: 58 Emerging  →  Sep 2026: 71 Confirming  →  Jan 2027: 86 Mainstream
```

**Hard guardrail — this is *not* a prediction market.** It is evidence-weighted and
source-quality-weighted, never vote- / opinion- / like-weighted.

| | The question it asks |
|---|---|
| Prediction markets | "What do people *believe* will happen?" |
| **UVRN** | "What does the *evidence* currently suggest?" |

That distinction is the product's spine and its brand promise (§7), and it differentiates
UVRN from Polymarket / Metaculus.

---

## 6. Receipts as a wiki tree (the structural backbone)

Today DRVC3 receipts are a **flat append log**. The target is a **wiki tree** — each
receipt is a **node** with links, so history is *walkable*, not just scrollable:

- **Down a claim's thread** — all receipts for one claim chained oldest→newest by stable
  claim-ID = the claim's full revision history (58 → 71 → 86, with the receipt that moved
  each step). The corrections trail, made navigable.
- **Across related claims** — parent/child + sibling links (`MAXI-POD` → sub-niches
  `dopamine-dressing`, `cluttercore`; or a broad claim ← the narrower claims that serve as
  its evidence). This branching is what makes it a *tree/wiki* rather than a list.
- **Out to evidence** — each node links the sources it weighed and their reliability
  scores, recording *which evidence* produced that verdict at that moment.

**Payoff:** total historical traceability. From any current verdict you can climb back
through every prior verdict (what changed belief, and when) and branch sideways into
related claims. Receipts stop being proof-of-a-moment and become a **connected memory of
how belief evolved**.

This aligns with what already exists: `CLAUDE.md` already calls the Expanse page *"the
single public wiki for all runs,"* and receipts already publish to `/access`. So this is
mostly **giving the existing ledger a graph structure** (receipts keyed + cross-linked by
claim-ID) rather than building a new system.

---

## 7. Positioning (Solution Part Four)

> **UVRN — The Stock Market for Information**
> *Track claims, trends, and opportunities through evidence, not opinions.*

The first line gets attention; the second explains the product. Most people will initially
assume "prediction markets" — and the positioning's whole job is to mark the difference
(§5): UVRN reports *what the evidence currently suggests*, not *what people believe will
happen*. The longer-range framing is **"Bloomberg for Reality"**: where Bloomberg tracks
stocks/bonds/commodities/currencies, UVRN tracks trends, technologies, products, cultural
shifts, scientific claims, economic narratives, and business opportunities — each a living
asset with confidence, evidence, momentum, volatility, source quality, and historical
performance.

---

## 8. The four candidate lattice abilities

| Layer | Ability (working name) | Gives UVRN |
|---|---|---|
| **1** | **Claim ↔ Evidence Sufficiency** — claim → required-evidence-class → verdict | Honesty |
| **2** | **Claim-Performance Ledger** — persist a claim, re-score over time, track source reliability | Accountability + memory |
| **3** | **Claim-as-Asset / Ticker** — confidence, momentum, volatility, status, source leaderboard | A market for reality |
| **4** | **Positioning** — "Stock Market for Information" identity & framing | Category definition |

---

## 9. How it maps onto existing UVRN substrate (build on, don't duplicate)

The bones already exist in `uvrn-home` (confirmed by exploring the codebase):

- **Delta Engine** already lives in each log entry's `deltaResult`
  (`src/data/expanse-log.json`): per-source `score`, `outcome`
  (`consensus` / `indeterminate`), `deltaFinal` vs `threshold`, `metricsCompared`.
- **Credibility tiers incl. `T?`** already implemented (`CREDIBILITY_TIERS` in
  `src/components/expanse/config.js`) — the transparency asset the critique praised.
- **Append-only log + DRVC3 receipts + 5×/day cron** = natural substrate for the Layer-2
  ledger and a future "revisit & re-score at 30 / 60 / 90 days" routine.
- **`recharts` already installed**, plus an existing chart harness
  (`src/components/ui/chart.jsx`, `src/hooks/useChartSeries.js`,
  `src/lib/chartTransforms.js`) → substrate for a Layer-3 ticker view.

**The one primitive the current model lacks:** a **stable claim ID / thread** so the
*same* claim can be revisited and re-scored across runs (today entries are independent
appends, not a continuing thread). This is the seam everything in §4–§6 hangs on.

---

## 10. Open decisions (deferred)

1. **Where it's transcribed** — the `lattice` package vs. `uvrn-home` vs. both.
   *Undecided; revisit after reviewing the package repo.*
2. **Deliverable type** — spec / ability transcription vs. prototype vs. full build.
   *Undecided; depends on #1.*
3. **Repo access** — `uvrn-packages_builds_private_1` is currently outside this session's
   GitHub scope. To proceed it must be added to the session (web Environment settings) or
   its lattice structure pasted in.

## 11. Suggested next step

Review the lattice package together → resolve §10 #1/#2 → then a focused planning pass to
transcribe **Layer 1 (Claim ↔ Evidence Sufficiency)** first, since Layers 2–3 build on its
claim/evidence taxonomy and the stable claim-ID primitive.
