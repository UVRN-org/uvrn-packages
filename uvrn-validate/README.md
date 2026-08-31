# @uvrn/validate

Easy-verify front desk for a **DataPoint**: Stage1 shape honesty, optional Stage2 relational
measurement via existing `@uvrn/measure`.

**Never emits `verified`.** Stage1 is `structurally-ok` | `malformed` only — not
`integrity-checked` (that word is receipt hash-recompute only).

`sourceRef` on the DataPoint is Stage1-shaped only in v0 and does **not** feed Stage2;
Stage2 is host-sources-only (`options.sources`). Connectors/mock/`score_claim` full path =
expand-later.

## Install

```bash
pnpm add @uvrn/validate @uvrn/measure @uvrn/core
```

## Usage

```typescript
import { validateDataPoint } from '@uvrn/validate';

// Stage1 only
const shape = validateDataPoint({ id: 'dp-1', kind: 'metric', value: 42 });
// shape.stage1 === 'structurally-ok' | 'malformed'

// Stage2 only when explicitly flagged
const relational = validateDataPoint(
  { id: 'dp-1', kind: 'metric', value: 42 },
  {
    runStage2: true,
    sources: [
      { id: 'a', kind: 'numeric', value: 100 },
      { id: 'b', kind: 'numeric', value: 101 },
    ],
  }
);
// relational.stage2.token — measure vocabulary, or insufficient-data when <2 sources
```

Stage2 headline tokens (from `@uvrn/measure` starter verdicts): `agree`, `no-agreement`,
`disagree`, `none`, `conflict`, `potential`, `insufficient-data`. Prefer-agree headline
means diverging numerics commonly surface as `no-agreement`.

## Honesty walls

| Word | This package |
|---|---|
| `verified` | Never emit |
| `integrity-checked` | Not Stage1 |
| `structurally-ok` / `malformed` | Stage1 |
| `insufficient-data` | Honest Stage2 success when evidence is short |
| `no-agreement` / `none` | Real measure verdicts Stage2 may forward |

Agent usage rules: see [`SKILL.md`](SKILL.md).

## MCP

Tip tool: `delta_validate_datapoint` in `@uvrn/mcp` (additive; does not overload
`delta_validate_bundle`).
