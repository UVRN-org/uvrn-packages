# @uvrn/lattice

Cross-domain evidence decomposition for the UVRN protocol.

`@uvrn/lattice` takes a multi-domain research question, decomposes it into domain-specific signal bundles, normalizes those signals into `@uvrn/core` `DataSpec` records, and runs the resulting `DeltaBundle` through `runDeltaEngine()`.

## Install

```bash
npm install @uvrn/lattice @uvrn/core
```

`@uvrn/core` is a required peer dependency. `@uvrn/normalize` and `@uvrn/farm` are optional peer dependencies for future provider and normalization integrations.

## Usage

```ts
import { BUILT_IN_TEMPLATES, MockDomainConnector, runLattice } from '@uvrn/lattice';

const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar');

if (!template) {
  throw new Error('Missing builder-radar template');
}

const receipt = await runLattice(
  'Should regional robotics builders enter municipal maintenance markets?',
  template,
  { connector: new MockDomainConnector() }
);

console.log(receipt.vScore, receipt.deltaReceipt.outcome);
```

## Manual search (Cowork)

For manual Cowork sessions where Claude drives search in real time, pass a `searchDelegate`
directly to `runLattice()`. Instead of calling an external API, the delegate is a function that
performs the search and returns raw `SearchResult[]`, which lattice normalizes into
`DomainSignal[]`. `runLattice()` wires the delegate into a `ClaudeSearchConnector` internally —
no manual connector construction required.

`runLattice()` calls the delegate **once per lattice domain** (for example, four times for
`builder-radar`). Scope each search using `domainSpec.id` and `domainSpec.label` so economic,
legal, technical, and cultural domains receive distinct evidence.

```ts
import { BUILT_IN_TEMPLATES, runLattice } from '@uvrn/lattice';

const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === 'builder-radar');

if (!template) {
  throw new Error('Missing builder-radar template');
}

const receipt = await runLattice(
  'Is this SaaS idea worth building this week?',
  template,
  {
    searchDelegate: async (query, domainSpec) => {
      // Claude receives this call and performs live search via browser/web tools,
      // returning real SearchResult[] scoped to the active lattice domain.
      return [
        {
          title: 'Example result',
          url: 'https://techcrunch.com/example',
          snippet: 'Example snippet',
          publishedAt: '2026-05-20',
          domain: 'techcrunch.com',
        },
      ];
    },
  }
);

console.log(receipt.vScore, receipt.interpretation);
```

Connector resolution priority (highest to lowest): `connectors[domainId]` → `connector` →
`searchDelegate` → `MockDomainConnector` (zero-external fallback). Existing callers passing a
`connector` or `connectors` map are unaffected.

### Advanced: constructing the connector yourself

`searchDelegate` is the recommended path. If you need to reuse a single connector instance, set
a custom `name`, or wrap the delegate yourself, construct `ClaudeSearchConnector` directly and
pass it as `connector`:

```ts
import { ClaudeSearchConnector, runLattice } from '@uvrn/lattice';

const connector = new ClaudeSearchConnector({ delegate: mySearchFn, label: 'web-search' });
const receipt = await runLattice(query, template, { connector });
```

## Claim ↔ Evidence Sufficiency

The V-Score answers *"do the sources agree?"* (consensus). Sufficiency answers a different
question: *"is the right **kind** of evidence present for this specific claim?"* A trend can have
strong consensus that it is *talked about* while having no evidence that it *sells* — those are
different claims with different burdens of proof.

`verifyClaim()` grades evidence **relative to the claim it is asked to support**. It is
standalone and zero-external — no lattice run required.

```ts
import { verifyClaim } from '@uvrn/lattice';

verifyClaim('People are buying maximalist POD products', [
  { source: 'Etsy sales' },
  { source: 'marketplace velocity' },
]);
// → status: 'Supported', level: 'L3', licensedClaimLevel: 'L3'

verifyClaim('Maximalist POD outperforms minimalism', [{ source: 'Pinterest' }]);
// → status: 'Unverified', missingEvidence: ['purchase'], licensedClaimLevel: 'L1'
```

### The claim ladder

Burden of proof rises with the claim's verb. Each level requires a distinct evidence class.

| Level | Claim says… | Required evidence |
|-------|-------------|-------------------|
| L1 | people are talking about it | `attention` (search/social volume) |
| L2 | people are interested | `interest` (engagement, saves, clicks) |
| L3 | people are buying | `purchase` (sales, marketplace velocity) |
| L4 | businesses are succeeding | `commercial_outcome` (profit, revenue, share) |
| L5 | durable market opportunity | `market_expansion` + `repeat_purchase` |

### Evidence taxonomy

Each source proves **one** class — these are different claims, not weaker/stronger versions:
`attention`, `interest`, `supply_entry`, `purchase`, `repeat_purchase`, `commercial_outcome`,
`market_expansion`. The taxonomy is domain-general: temperature records and CPI/PPI map to
`market_expansion`, so "Earth is warming" and "inflation is rising" verify the same way POD
trends do.

### Pluggable classifier and tagger

The shipped `RuleBasedClaimClassifier` and `DefaultEvidenceTagger` are the zero-external
defaults. Both are interfaces — supply a custom `EvidenceTagger` (or `overrides`) for
domain-specific vocabulary, or an `AsyncClaimClassifier` (LLM-driven) via `verifyClaimAsync`.
The score is named `evidenceCoverageScore`, deliberately **not** "confidence", to keep it
distinct from the V-Score.

### `AsyncClaimClassifier` — the production classification path

The keyword-based `RuleBasedClaimClassifier` remains the zero-dep default, but for production
use an `AsyncClaimClassifier` backed by a real model is the first-class path. The interface is
two members; the host (for example an MCP host) owns the LLM call and returns a `ClaimSpec`:

```ts
import { verifyClaimAsync } from '@uvrn/lattice';
import type { AsyncClaimClassifier, ClaimLevel, ClaimSpec, EvidenceClass } from '@uvrn/lattice';

// An MCP host implementing the classifier: the host receives the claim text, asks its
// model to grade it onto the L1–L5 ladder, and returns the typed ClaimSpec.
class McpHostClaimClassifier implements AsyncClaimClassifier {
  readonly name = 'mcp-host-llm-classifier';

  async classify(claimText: string): Promise<ClaimSpec> {
    // ← your MCP host / LLM SDK call goes here. Ask the model for the ladder level and
    //   the evidence classes the claim requires, e.g. as structured JSON output.
    const llm = await callModel({
      prompt: `Grade this claim onto the UVRN ladder (L1–L5) and list the required evidence classes: "${claimText}"`,
    });

    return {
      text: claimText,
      level: llm.level as ClaimLevel,                       // e.g. 'L3'
      requiredEvidence: llm.evidence as EvidenceClass[],    // e.g. ['purchase']
      classifier: this.name,                                // provenance: who classified
      explanation: llm.rationale,
    };
  }
}

const verdict = await verifyClaimAsync(
  'People are buying maximalist POD products',
  [{ source: 'Etsy sales' }, { source: 'marketplace velocity' }],
  { classifier: new McpHostClaimClassifier() }
);
```

Evidence tagging stays in-process — only claim classification is awaited. Pair this with a
real `DomainConnector` (or `searchDelegate`) for fully non-synthetic runs: as of v4,
`MockDomainConnector` logs a loud one-time warning when constructed outside test environments
(`NODE_ENV !== 'test'` and no `JEST_WORKER_ID`), because mock signals are synthetic and must
not be trusted as research output.

### Optional `runLattice` integration

Pass `claim` to `runLattice()` to attach a `SufficiencyVerdict` to the receipt. Because lattice
signal sources are URIs like `mock://…` that the default taxonomy cannot classify, supply
provenance evidence explicitly via `evidence` (or a custom `evidenceTagger`):

```ts
const receipt = await runLattice(query, template, {
  searchDelegate: mySearchFn,
  claim: 'People are buying municipal robotics services',
  claimId: 'ROBO-MUNI',
  evidence: [{ evidenceClass: 'purchase', source: 'procurement records', explanation: 'tenders' }],
});

console.log(receipt.vScore, receipt.sufficiency?.status);
```

A **high `vScore` with an `Unverified` sufficiency verdict is valid and expected**: the sources
agree, but none of the agreed-upon evidence is of the kind the claim requires.

`claim` is independent of the lattice `query`. If they differ, the V-Score scores the `query`
while sufficiency judges the `claim` — sometimes intentional (a broad research query, a narrow
claim to verify), but be aware the two reads then refer to different statements.

## Design

- Provider integrations are pluggable through the `DomainConnector` interface.
- The package ships `MockDomainConnector` so the zero-external path works. Its data is synthetic: constructing it outside test environments emits a one-time `console.warn` so mock signals are never mistaken for research output.
- `ClaudeSearchConnector` supports manual Cowork sessions via a runtime `SearchDelegate`, wired automatically when you pass `searchDelegate` to `runLattice()`.
- Receipts are reproducible: `runLattice` threads its single run timestamp to every connector via `ConnectorContext`, so the same query + `options.timestamp` yields the same receipt hash. Provide `options.timestamp` for verifiable, re-derivable receipts. Custom connectors should honor `context.timestamp` (or pin their own signal `ts`) to stay reproducible.
- V-Score math is not reimplemented here. Lattice reads `deltaFinal` from the `DeltaReceipt` returned by `@uvrn/core`.
- `verifyClaim()` adds claim/evidence sufficiency as a separate, coverage-based concept — orthogonal to the V-Score.
- Output objects include concise `explanation` fields for LLM-readable receipts and logs.

## Built-In Templates

- `builder-radar`
- `content-opportunity`
- `market-narrative`
- `seo-topic-intelligence`
- `campaign-intelligence`
- `full-lattice`

## Development

```bash
pnpm --filter @uvrn/lattice run test
pnpm --filter @uvrn/lattice run build
```
