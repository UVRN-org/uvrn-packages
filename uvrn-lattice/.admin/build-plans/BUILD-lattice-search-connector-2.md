# Build Plan: Lattice Search Connector Build 2
## `@uvrn/lattice` — SearchDelegate Auto-Connector

**Package:** `@uvrn/lattice`
**Build:** 2 of N (Search Connector series)
**Date:** 2026-05-25
**Protocol:** Bloom Protocol v1.7 — Plan → Build → Check → Update → Reflect → Continue
**Prereq:** Build 1 complete — `ClaudeSearchConnector` implemented, 8/8 tests passing
**Status:** ✅ Executed in v0.3.0 — `searchDelegate` wired into `LatticeOptions` /
`resolveConnector`; 5 auto-connector tests added. **`FirecrawlSearchDelegate` intentionally
skipped** (decision: keep the package zero-runtime-dep and Cowork-oriented; callers wire their
own search backend). `SearchDelegate` was already public via `export * from './connectors'`, so
no `index.ts` change was needed.

---

## Goal

Wire `SearchDelegate` into `LatticeOptions` so `runLattice()` can invoke search automatically
for any domain, without the caller manually constructing a `ClaudeSearchConnector` and passing
it as `options.connector`. The connector wiring stays in lattice internals — the public API
gains one optional field.

---

## Current State (Build 1 baseline)

### `LatticeOptions` (src/types.ts)

```typescript
export interface LatticeOptions {
  connector?: DomainConnector;
  connectors?: Record<string, DomainConnector>;
  thresholdPct?: number;
  maxRounds?: number;
  timestamp?: string;
  receiptId?: string;
}
```

### `resolveConnector` (src/lattice.ts:~line 100)

```typescript
function resolveConnector(domainId: string, options: LatticeOptions): DomainConnector {
  return options.connectors?.[domainId] ?? options.connector ?? new MockDomainConnector();
}
```

### `ClaudeSearchConnector` (src/connectors/search/ClaudeSearchConnector.ts)

- `SearchDelegate` type: `(query: string, domainSpec: DomainSpec) => Promise<SearchResult[]>`
- Constructed with `{ delegate: SearchDelegate, label?: string }`
- Fully implements `DomainConnector` interface

### Current caller pattern (manual, Build 1 style)

```typescript
const connector = new ClaudeSearchConnector({ delegate: mySearchFn });
const receipt = await runLattice(query, template, { connector });
```

---

## Target State (Build 2)

### `LatticeOptions` addition

Add one optional field:

```typescript
export interface LatticeOptions {
  connector?: DomainConnector;
  connectors?: Record<string, DomainConnector>;
  searchDelegate?: SearchDelegate;        // ← NEW
  thresholdPct?: number;
  maxRounds?: number;
  timestamp?: string;
  receiptId?: string;
}
```

### `resolveConnector` update

Extend the fallback chain to auto-construct a `ClaudeSearchConnector` when
`searchDelegate` is provided and no explicit connector is found for the domain:

```typescript
function resolveConnector(domainId: string, options: LatticeOptions): DomainConnector {
  return (
    options.connectors?.[domainId] ??
    options.connector ??
    (options.searchDelegate
      ? new ClaudeSearchConnector({ delegate: options.searchDelegate })
      : new MockDomainConnector())
  );
}
```

### New caller pattern (auto, Build 2 style)

```typescript
const receipt = await runLattice(query, template, { searchDelegate: mySearchFn });
```

No manual connector construction. The delegate is injected once; `runLattice` handles the rest.

---

## Connector resolution priority (unchanged)

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | `options.connectors[domainId]` | Per-domain override — highest priority |
| 2 | `options.connector` | Single connector for all domains |
| 3 | `options.searchDelegate` | Auto-wraps in ClaudeSearchConnector — NEW |
| 4 | `MockDomainConnector` | Fallback — zero external deps |

Existing callers using `connector` or `connectors` are unaffected — no breaking change.

---

## Scope

### Files to modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `searchDelegate?: SearchDelegate` to `LatticeOptions` |
| `src/lattice.ts` | Update `resolveConnector()` fallback chain; add import for `ClaudeSearchConnector` and `SearchDelegate` |

### Files to add

| File | Purpose |
|------|---------|
| `tests/lattice-search-delegate.test.ts` | New test file covering auto-connector path |
| `src/connectors/search/FirecrawlSearchDelegate.ts` | Reference implementation — factory wrapping `@mendable/firecrawl-js` |

### Files NOT to touch

- `src/connectors/search/ClaudeSearchConnector.ts` — Build 1, locked
- `src/connectors/search/index.ts` — may need re-export of `SearchDelegate` type (check only)
- `src/connectors/MockDomainConnector.ts` — untouched
- `src/normalizer/`, `src/router/`, `src/templates/` — out of scope
- `src/index.ts` — check if `SearchDelegate` needs to be re-exported publicly (additive only)

---

## Test plan

### New tests (`tests/lattice-search-delegate.test.ts`)

1. **Auto-connector invoked** — pass `searchDelegate` only (no `connector`/`connectors`);
   confirm `runLattice()` calls the delegate and returns a valid `LatticeReceipt`
2. **Connector override wins** — pass both `connector` and `searchDelegate`; confirm
   `connector` takes priority (delegate never called)
3. **Per-domain override wins** — pass `connectors[domainId]` + `searchDelegate`; confirm
   per-domain connector takes priority
4. **Mock fallback intact** — pass no connector options; confirm `MockDomainConnector`
   is still the fallback (existing behavior preserved)
5. **Delegate error propagates** — delegate throws; confirm `runDomain` catches and
   returns a `DomainResult` with `status: 'error'` (same as existing error path)

### Existing tests must still pass

- `tests/lattice.test.ts` (or equivalent) — all 8 currently passing tests
- No changes to existing test files

---

## Reference implementation — `FirecrawlSearchDelegate`

Hermes Agent uses Firecrawl as its default web search backend (`web_search` tool). The same
Firecrawl search endpoint is available directly via `@mendable/firecrawl-js` and is the
recommended reference implementation for `SearchDelegate` in this package.

### Why Firecrawl

- Same backend Hermes uses — "powered by Hermes search" is accurate
- Returns page content as markdown alongside title/URL/snippet — richer than standard search APIs
- Free tier available; no infra required
- `@mendable/firecrawl-js` is a lightweight npm package, not a runtime dependency of lattice itself

### Implementation pattern

```typescript
// src/connectors/search/FirecrawlSearchDelegate.ts
import FirecrawlApp from '@mendable/firecrawl-js';
import type { SearchDelegate, SearchResult } from './ClaudeSearchConnector';
import type { DomainSpec } from '../../types';

export function createFirecrawlSearchDelegate(apiKey: string): SearchDelegate {
  const firecrawl = new FirecrawlApp({ apiKey });

  return async (query: string, domainSpec: DomainSpec): Promise<SearchResult[]> => {
    const response = await firecrawl.search(query, { limit: 5 });

    return (response.data ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url,
      snippet: r.description ?? r.markdown?.slice(0, 300) ?? '',
      publishedAt: r.metadata?.publishedAt,
      domain: (() => { try { return new URL(r.url).hostname; } catch { return undefined; } })(),
    }));
  };
}
```

### Caller pattern with Firecrawl delegate

```typescript
import { createFirecrawlSearchDelegate } from '@uvrn/lattice/connectors/search/FirecrawlSearchDelegate';

const receipt = await runLattice(query, template, {
  searchDelegate: createFirecrawlSearchDelegate(process.env.FIRECRAWL_API_KEY!),
});
```

### Scope for this file

- Add `src/connectors/search/FirecrawlSearchDelegate.ts` — factory function only, ~25 lines
- `@mendable/firecrawl-js` goes in `devDependencies` only (it's an example, not a peer dep)
- Export from `src/connectors/search/index.ts` alongside `ClaudeSearchConnector`
- Document in README under "Reference Implementations"
- **Do not add `@mendable/firecrawl-js` to `peerDependencies` or `dependencies`** — callers
  install it themselves if they use this delegate

---

## Constraints

- Do not modify `ClaudeSearchConnector` — Build 1 is locked
- Do not change `DomainConnector` interface
- Do not add `@mendable/firecrawl-js` as a peer or runtime dep — devDep only
- `searchDelegate` is optional — no breaking change to `LatticeOptions`
- `MockDomainConnector` fallback must remain the zero-dep path
- `dist/` is never committed

---

## Definition of done

- [x] `src/types.ts` — `searchDelegate` field added to `LatticeOptions`
- [x] `src/lattice.ts` — `resolveConnector()` extended; `ClaudeSearchConnector` imported
- [x] `SearchDelegate` type exported from `src/index.ts` — already public via `export * from './connectors'`; no change needed
- [x] New test file written — all 5 cases pass (`tests/lattice-search-delegate.test.ts`)
- [x] Existing 8 tests still pass
- [x] `pnpm --filter @uvrn/lattice run build` — clean (`tsc`)
- [x] `pnpm --filter @uvrn/lattice run test` — all pass
- [x] README updated with `searchDelegate` usage example (Firecrawl reference omitted — see below)
- [x] CHANGELOG.md updated (minor bump — additive, non-breaking) → v0.3.0

### Deferred — Firecrawl reference (intentionally skipped)

Decision: keep `@uvrn/lattice` zero-runtime-dep and Cowork-oriented; callers wire their own
search backend. Not implemented in v0.3.0.

- [ ] ~~`FirecrawlSearchDelegate.ts` added~~ — deferred
- [ ] ~~`@mendable/firecrawl-js` in `devDependencies`~~ — deferred
- [ ] ~~`FirecrawlSearchDelegate` exported from `src/connectors/search/index.ts`~~ — deferred

---

## Open questions (RESOLVED)

1. Is `SearchDelegate` currently exported from `src/index.ts`? **Yes** — already public via
   `export * from './connectors'` → `connectors/search/index.ts`. No change needed.
2. Should `searchDelegate` be per-domain or global only? **Global only** — one delegate for all
   domains. Per-domain overrides remain available via the existing `connectors` map.

---

*Bloom Protocol: Plan → Build → Check → Update → Reflect → Continue*
