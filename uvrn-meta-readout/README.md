# @uvrn/meta-readout

Pure `HumanView` → `MetaReadout` facts bag for soft-go conversational context.

**Soft go ≠ buy.** This package projects receipt render facts for hosts that need a stable readout shape. It is **not** the Meta Indicator product SKU, and it does **not** export buy/rank/opportunity-score APIs or strings that order buy/sell.

## Install

```bash
pnpm add @uvrn/meta-readout @uvrn/receipt
```

## Usage

```typescript
import { readMetaReadout } from '@uvrn/meta-readout';
import type { HumanView } from '@uvrn/receipt';

const readout = readMetaReadout(view);
// readout.honestyFlags may include:
//   missing-actionable-explanation | weak-or-inconsistent-sources |
//   gaps-present | unsigned-provenance
```

## CAP-1 surface

- `readMetaReadout(view)` — pure map; never invents drivers when `actionableExplanation` is absent
- `MetaReadout` — facts bag type

CAP-2/3 APIs (`suggestConversationalStance`, `buildAgentFeed`) are intentionally omitted here.

## Package boundary

Depends on `@uvrn/receipt` for `HumanView` (and related render types). No storage, signer, network, or ranking law.
