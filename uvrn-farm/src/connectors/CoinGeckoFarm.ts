import type { ClaimRegistration, FarmResult } from '../types';
import { FarmConnectorError } from '../types';

import { BaseConnector } from './base/BaseConnector';

interface CoinGeckoSearchResponse {
  coins?: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank?: number;
  }>;
}

export class CoinGeckoFarm extends BaseConnector {
  readonly name = 'CoinGeckoFarm';

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? this.claimFromString(claim) : claim;
    const startedAt = Date.now();

    try {
      const query = encodeURIComponent(registration.query);
      const payload = await this.requestJson<CoinGeckoSearchResponse>(
        `https://api.coingecko.com/api/v3/search?query=${query}`
      );

      const sources = (payload.coins ?? []).slice(0, 5).map((coin) => ({
        url: `https://www.coingecko.com/en/coins/${coin.id}`,
        title: `${coin.name} (${coin.symbol.toUpperCase()})`,
        snippet: coin.market_cap_rank != null
          ? `CoinGecko search match ranked #${coin.market_cap_rank}.`
          : 'CoinGecko search match with market metadata.',
        publishedAt: new Date().toISOString(),
        credibility: 0.85,
      }));

      return this.buildResult(registration, sources, startedAt);
    } catch (error) {
      if (error instanceof FarmConnectorError) {
        throw error;
      }

      throw new FarmConnectorError(this.name, 'Failed to fetch CoinGecko search results', error);
    }
  }
}
