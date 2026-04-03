# @uvrn/normalize

`@uvrn/normalize` standardizes `FarmSource` objects into a stable output shape before they move into higher-level aggregation or scoring. The package is profile-driven and extensible: the `NormalizationProfile` interface is the contract, while the built-in profiles are examples/defaults you can use, extend, or replace.

## Minimal install

```bash
npm install @uvrn/normalize @uvrn/core @uvrn/agent
```

`@uvrn/farm` is an optional peer when you want to pair normalization directly with farm connectors, but the package only depends on the shared `FarmSource` contract from `@uvrn/agent`.

## Built-in Profiles

These are examples/defaults, not requirements:

- `financial`
- `research`
- `news`
- `general`

```ts
import { normalize, NormalizationProfiles } from '@uvrn/normalize';

const result = normalize(farmResult.sources, NormalizationProfiles.financial);
```

## Custom Profile

`NormalizationProfile` is public and intended for user-defined domains.

```ts
import type { NormalizationProfile } from '@uvrn/normalize';

const customProfile: NormalizationProfile = {
  name: 'custom',
  description: 'My domain-specific normalization',
  transform(source) {
    return {
      name: source.title,
      value: source.snippet,
      unit: 'text',
      timestamp: Date.parse(source.publishedAt ?? new Date().toISOString()),
      credibility: source.credibility ?? 0.5,
      rawData: source,
      normalizer: 'custom',
    };
  },
  normalizeTimestamp(timestamp) {
    return typeof timestamp === 'number' ? timestamp : Date.parse(String(timestamp));
  },
  normalizePrecision(value) {
    return value;
  },
};
```

## Custom Transformer

When a provider needs special handling, register a transformer for that source family. Because the shared `FarmSource` shape does not include an explicit provider field, `@uvrn/normalize` matches providers heuristically from URL, title, and snippet patterns.

```ts
import { normalize } from '@uvrn/normalize';

normalize.registerTransformer('CoinGeckoFarm', (source) => ({
  name: 'CoinGeckoFarm',
  value: source.snippet,
  unit: 'text',
  timestamp: Date.now(),
  credibility: source.credibility ?? 0.85,
  rawData: source,
  normalizer: 'CoinGeckoFarm-custom',
}));
```

Source-specific transformers take priority over the selected profile's default `transform()` method.

## Public API

- `normalize`
- `NormalizationProfiles`
- `NormalizationProfile`
- `NormalizationResult`
- `NormalizedSource`
- `FarmSource`

## Dependencies

- Peer dependencies: `@uvrn/core`, `@uvrn/agent`
- Optional peer dependency: `@uvrn/farm`
- Runtime dependencies: none
