# @uvrn/score

`@uvrn/score` explains how a UVRN score is composed. It takes completeness, parity, and freshness components, applies the canonical weights, and returns a breakdown object plus a short explanation string that can be used directly in developer tooling or LLM-facing summaries.

## Minimal install

```bash
npm install @uvrn/score @uvrn/core
```

`@uvrn/core` is a peer dependency. This package does not require any other `@uvrn/*` package at runtime.

## Usage

```ts
import { SCORE_PROFILES, ScoreBreakdown } from '@uvrn/score';

const breakdown = new ScoreBreakdown(
  {
    completeness: 88,
    parity: 92,
    freshness: 75,
  },
  SCORE_PROFILES.financial
);

console.log(breakdown.final);        // 85.5
console.log(breakdown.explanation);  // short factual explanation
console.log(breakdown.toJSON());     // serializable breakdown
```

## Built-in profiles

The package ships with four reference profiles:

- `financial`
- `research`
- `news`
- `general`

These profiles explain how to interpret a score in a domain. They do not change the underlying UVRN formula.

## Custom profiles

`ScoringProfile` is public and user-extensible.

```ts
import { ScoreBreakdown, type ScoringProfile } from '@uvrn/score';

const customProfile: ScoringProfile = {
  name: 'operations',
  description: 'Operational incident claims',
  completenessNote: 'How broad the source coverage is',
  parityNote: 'How closely reports agree',
  freshnessNote: 'How recent the operational data is',
  thresholds: { stable: 78, drifting: 52 },
};

const breakdown = new ScoreBreakdown(
  { completeness: 84, parity: 81, freshness: 73 },
  customProfile
);
```

## Explanation output

`ScoreBreakdown.explanation` is designed to be short, factual, and verbatim-ready for logs, dashboards, and LLM responses.

## Public API

- `ScoreBreakdown`
- `SCORE_PROFILES`
- `WEIGHTS`
- `ScoringProfile`
- `ComponentBreakdown`
- `ScoreBreakdownResult`
- `ScoreInputComponents`

## Dependencies

- Peer dependencies: `@uvrn/core`
- Runtime dependencies: none
