import type { ClaimRegistration, FarmResult } from '../types';
import { FarmConnectorError } from '../types';

import { BaseConnector } from './base/BaseConnector';

interface CoinbaseCurrenciesResponse {
  data?: Array<{
    id: string;
    name: string;
    min_size?: string;
  }>;
}

export class CoinbaseFarm extends BaseConnector {
  readonly name = 'CoinbaseFarm';

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? this.claimFromString(claim) : claim;
    const startedAt = Date.now();

    try {
      const payload = await this.requestJson<CoinbaseCurrenciesResponse>(
        'https://api.coinbase.com/v2/currencies'
      );
      const query = registration.query.toLowerCase();

      const matches = (payload.data ?? [])
        .filter((currency) => {
          const id = currency.id.toLowerCase();
          const name = currency.name.toLowerCase();
          return id.includes(query) || name.includes(query);
        })
        .slice(0, 5);

      const sources = matches.map((currency) => ({
        url: `https://www.coinbase.com/price/${currency.id.toLowerCase()}`,
        title: `${currency.name} (${currency.id})`,
        snippet: currency.min_size
          ? `Coinbase listing with minimum trade size ${currency.min_size}.`
          : 'Coinbase currency listing available on the public exchange catalog.',
        publishedAt: new Date().toISOString(),
        credibility: 0.9,
      }));

      return this.buildResult(registration, sources, startedAt);
    } catch (error) {
      if (error instanceof FarmConnectorError) {
        throw error;
      }

      throw new FarmConnectorError(this.name, 'Failed to fetch Coinbase market data', error);
    }
  }
}
