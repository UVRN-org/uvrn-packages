---
name: uvrn-factcheck
description: Cross-reference and fact-check a claim or research finding against independent sources, re-check the agent's own work, and deliver a scored result with a chart. Use when the user asks to fact-check, cross-reference, double-check, rate the reliability of, or sanity-check a claim, an article, or AI research output.
---

# UVRN-style cross-reference (fact-check engine)

Turns "I read some sources" into a measured, auditable result: how many **independent origins** agree, how fresh the evidence is, whether sources conflict, and whether the agent's own re-checks passed. The math is ported from UVRN (`@uvrn/consensus`, `@uvrn/score`, `@uvrn/measure`, `@uvrn/drift`) and runs from the bundled script — you do not do the arithmetic yourself.

## Workflow

1. **Pin the claim.** One precise, checkable statement, plus the date it is evaluated. If it is vague, narrow it or ask one question.
2. **Gather independent sources.** Search and read them yourself. Cite only what you actually read. Actively look for sources that *disagree* and include them.
3. **Encode each source** (fields below). Be honest about `originId`: if a source reprints, quotes or derives from another, give it the original's `originId` so the same voice is counted once.
4. **Self-check pass — the double-check.** Record each check as `pass`, `fail` or `unresolved`:
   - re-read the primary source for every key figure;
   - recompute any arithmetic;
   - trace each source back to its origin (reprint? press release repeated?);
   - run at least one search aimed at *contradicting* evidence;
   - confirm dates (when was it true vs. when was it published).
   A failed check means fix the inputs and re-run, or report it. Never delete a failed check.
5. **Run it** (path is relative to this skill folder):
   `node scripts/run.mjs factcheck input.json --out <dir> --name <slug>`
   It prints one JSON summary line and writes `<slug>.json` and `<slug>.html`.
6. **Deliver text AND a chart, never text alone.** Reply with 3–5 sentences: the headline, the V-Score and band, the limiting factor, any conflict or dissent, the self-check outcome, and caveats. Show the HTML report (publish it as an artifact if the Artifact tool is available, otherwise send the file).
7. **Ask once:** "Want a Markdown report to go with this?" If yes, re-run with `--md` and deliver `<slug>.md`.

## Input (`input.json`)

```json
{
  "claim": "…",
  "profile": "news",
  "evaluatedAt": "2026-10-18T15:00:00Z",
  "sources": [
    { "id": "s1", "title": "…", "url": "https://…", "originId": "https://original…",
      "publishedAt": "ISO", "measuredAt": "ISO", "credibility": 90,
      "value": 4.25 }
  ],
  "checks": [ { "id": "c1", "question": "…", "result": "pass|fail|unresolved", "note": "…" } ],
  "history": [0.4, 0.55, 0.7]
}
```

- Each source needs **exactly one of** `value` (a number) **or** `assertion` (a short, consistently worded position such as `"supports"`, `"contradicts"`, `"held steady"`; same position = same words).
- `credibility` 0–100 is your judgment: official/primary 90+, reputable secondary 70–85, unknown 40–60, anonymous or promotional 10–30. State your basis in the reply.
- `measuredAt` is when the fact was true or measured, not when it was published. A source with no `measuredAt` scores 0 for freshness; say so rather than inventing a date.
- `profile`: `financial`, `research`, `news` or `general` (sets the STABLE/DRIFTING/CRITICAL thresholds).
- `history` (optional): earlier agreement scores 0–1, to detect early convergence ("potential").
- Optional: `freshnessWindowDays` (default 30, as in UVRN), `decay` `{curve, rate, ageHours}`, `weights`, `dedup`. If you change a default, tell the user.

## Reading the result

- `status: insufficient-independent-sources` is a valid, honest answer: fewer than two independent origins. Say it plainly and do not pad the list.
- V-Score = Completeness 35% + Parity 35% + Freshness 30%. Parity counts **distinct origins**, one vote each.
- Freshness penalizes old evidence. For a past event whose best sources are legitimately old, point out that freshness is the limiting factor instead of treating the low score as doubt about the claim.
- Measurements: `agree`, `disagree` (numeric spread), `conflict` (mutually exclusive assertions), `potential` (needs `history`).
- Self-checks are reported **beside** the score and never blended into it.

## Honest vocabulary (binding)

- Say "cross-referenced", "sources agree", "no independent source contradicts". Do **not** say "verified", "proven" or "confirmed true" on the strength of this score. It measures how the supplied sources relate, not whether the world matches them.
- A high score from sources that copy each other is not corroboration; the script collapses shared origins, and you should say when that happened.
- Report gaps and missing origins; never invent corroboration to reach a count.
- The output is a UVRN-style analysis, not a signed UVRN receipt.
