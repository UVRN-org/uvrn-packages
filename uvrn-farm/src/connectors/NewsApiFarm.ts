import type { ClaimRegistration, FarmResult } from '../types';
import { FarmConnectorError } from '../types';

import { BaseConnector } from './base/BaseConnector';

interface NewsApiResponse {
  articles?: Array<{
    title: string;
    description?: string;
    url: string;
    publishedAt?: string;
  }>;
}

export class NewsApiFarm extends BaseConnector {
  readonly name = 'NewsApiFarm';

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? this.claimFromString(claim) : claim;
    const startedAt = Date.now();
    const apiKey = this.requireApiKey();

    try {
      const query = encodeURIComponent(registration.query);
      const payload = await this.requestJson<NewsApiResponse>(
        `https://newsapi.org/v2/everything?q=${query}&apiKey=${apiKey}`
      );

      const sources = (payload.articles ?? []).slice(0, 5).map((article) => ({
        url: article.url,
        title: article.title,
        snippet: article.description ?? 'NewsAPI result without a summary description.',
        publishedAt: article.publishedAt,
        credibility: 0.7,
      }));

      return this.buildResult(registration, sources, startedAt);
    } catch (error) {
      if (error instanceof FarmConnectorError) {
        throw error;
      }

      throw new FarmConnectorError(this.name, 'Failed to fetch NewsAPI results', error);
    }
  }
}
