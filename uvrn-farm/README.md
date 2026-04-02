# @uvrn/farm

`@uvrn/farm` is the UVRN protocol's provider-agnostic ingestion layer. It defines the connector contract used by `@uvrn/agent`, gives you a reusable base class for retry and timeout handling, and includes a few reference connectors that demonstrate the pattern without locking you to any specific third-party service.

## Minimal install

```bash
npm install @uvrn/farm @uvrn/core @uvrn/agent
```

`@uvrn/core` and `@uvrn/agent` are peer dependencies. No other UVRN package is required to implement your own connector.

## Bring Your Own Provider

`FarmConnector` is the contract. `BaseConnector` is the reusable scaffold. This is the primary use case.

```ts
import { BaseConnector } from '@uvrn/farm';
import type { ClaimRegistration, FarmResult } from '@uvrn/farm';

class MyConnector extends BaseConnector {
  readonly name = 'MyConnector';

  async fetch(claim: ClaimRegistration): Promise<FarmResult> {
    return {
      claimId: claim.id,
      sources: [
        {
          url: 'https://example.com/data',
          title: `${claim.label} evidence`,
          snippet: 'Your custom provider result goes here.',
          publishedAt: new Date().toISOString(),
          credibility: 0.8,
        },
      ],
      fetchedAt: new Date().toISOString(),
      durationMs: 10,
    };
  }
}
```

Concrete connectors may also expose a convenience `fetch(claim: string)` overload for standalone use.

## Reference Implementations

These classes are examples, not requirements:

- `CoinGeckoFarm`: public crypto search metadata, no API key required
- `CoinbaseFarm`: public currency catalog data, no API key required
- `PerplexityFarm`: research synthesis via Perplexity, API key required
- `NewsApiFarm`: news article search via NewsAPI, API key required

You can import them from the package root or from `@uvrn/farm/connectors`.

```ts
import { MultiFarm } from '@uvrn/farm';
import { CoinGeckoFarm, CoinbaseFarm } from '@uvrn/farm/connectors';

const farm = new MultiFarm([
  new CoinGeckoFarm(),
  new CoinbaseFarm(),
]);
```

## MultiFarm

`MultiFarm` runs multiple connectors in parallel with `Promise.allSettled()`, merges successful sources, and returns partial results if one connector fails. Set `failFast: true` if you want the first connector error to abort the run.

## Connector Registry

`ConnectorRegistry` stores named connectors and can assemble a `MultiFarm` instance from all registered connectors or a named subset.

## Public API

- `BaseConnector`
- `CoinGeckoFarm`
- `CoinbaseFarm`
- `PerplexityFarm`
- `NewsApiFarm`
- `MultiFarm`
- `ConnectorRegistry`
- `registry`
- `FarmConnector`
- `FarmResult`
- `FarmSource`
- `ClaimRegistration`
- `ConnectorConfig`
- `MultiFarmOptions`
- `FarmConnectorError`

## Dependencies

- Peer dependencies: `@uvrn/core`, `@uvrn/agent`
- Runtime dependencies: none
