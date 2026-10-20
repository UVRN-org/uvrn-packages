# uvrn-skills

UVRN-adapted skills for Claude: a **fact-checking / cross-reference engine**, a **probability layer**, and **trend analysis**. Every run returns text **and** a chart (self-contained HTML + inline SVG) and offers an optional Markdown report.

> Built on UVRN — https://github.com/UVRN-org/uvrn-packages (Apache-2.0). Not a published `@uvrn` package and not part of the pnpm workspace.

| Skill | What it does | Ported from |
|---|---|---|
| `uvrn-factcheck` | Cross-references independent sources (one vote per origin), scores them (V-Score 35/35/30), measures agree / disagree / conflict / potential, and records the agent's own re-checks **beside** the score | `consensus`, `score`, `measure`, `drift` |
| `uvrn-forecast` | A probability from market odds (de-vigged), a cited base rate (Jeffreys), or a labeled judgment; refuses instead of guessing; optional Brier track record | `probability`, `track-record` |
| `uvrn-trends` | Theil–Sen + OLS slope, Mann–Kendall test, outliers, linear projection, cautions | **new** (no UVRN equivalent) |

## How it works

Skills are instructions; the math is code. Each skill folder is self-contained: `SKILL.md` + `lib/` + `scripts/run.mjs` (zero dependencies, Node ≥ 18).

```
node scripts/run.mjs <factcheck|forecast|trend> input.json --out DIR [--md] [--name BASE]
```

`lib/` and `scripts/run.mjs` at the plugin root are the source of truth. `npm run sync` copies them into every skill (`--check` verifies). Never edit the copies.

## Fidelity to UVRN (`npm test`)

- Golden vectors in `../SPEC/vectors/probability-v1.json` (implied probability, Jeffreys, market cases).
- Differential tests against the built `@uvrn/consensus`, `score`, `measure`, `drift`, `track-record` (`dist/`; skipped if not built): ~160 randomized consensus cases, 400 score cases, 150 measurement cases, drift curves, Brier and reliability bins — all identical.
- Pipeline tests: standalone copy runs, refusals, HTML escaping, honest vocabulary.

**Not ported (yet):** JCS canonicalization, hashing and Ed25519 signing, so outputs are *UVRN-style analyses, not signed receipts*; Aalen–Johansen time-to-event base rates; `forecast v2/v3` identities (`questionHash`, deadlines with offsets); stance/quorum rules; learned credibility. Version-1-style market and proportion base-rate math is covered.

## Deliberate deviations (documented, tested)

1. **Independence is counted by origin.** `@uvrn/consensus` collapses sources whose values are within 1% and published within 24 h, and can then report "insufficient" even when two different origins agree exactly. Here the score components stay faithful to the package, but the independence gate, the measurements and the source list use one representative per origin. Conversely, many documents from one origin count once (the package would count them separately).
2. **Assertion mode.** Categorical claims (supports / contradicts) use origin clusters of identical assertions for parity. The package's numeric path is unchanged.
3. **Self-checks never enter the score.** They are reported beside it.
4. `freshnessWindowDays` is configurable (default 30, as in UVRN).

## Honest vocabulary (UVRN binding law 2)

Reports say "cross-referenced" or "sources agree", never "verified". A score measures how supplied sources relate, not whether the world matches them. Provisional thresholds inherited from `@uvrn/probability` (min 8 cases, 24 h quote age, spread ≤ 0.05, depth ≥ $1,000, overround ≤ 0.5) are not finalized by the package owner.

## Install / distribute

- **Claude Code:** `.claude-plugin/plugin.json` (plugin) and `.claude-plugin/marketplace.json` (self-hosted marketplace) are included. Not yet validated against an installer.
- **Claude Desktop plugins area:** add `dist/uvrn-skills.plugin` (a zip of `.claude-plugin/`, `skills/`, `NOTICE`, `README.md`; git-ignored, attach it to a release).
- **Claude Desktop / claude.ai:** zip one skill folder (e.g. `skills/uvrn-factcheck`) and upload as a skill.
- **Marketplaces:** review each marketplace's current submission rules before publishing.
