import type { ClaimRegistration, FarmResult } from '../types';
import { FarmConnectorError } from '../types';

import { BaseConnector } from './base/BaseConnector';

interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class PerplexityFarm extends BaseConnector {
  readonly name = 'PerplexityFarm';

  async fetch(claim: ClaimRegistration): Promise<FarmResult>;
  async fetch(claim: string): Promise<FarmResult>;
  async fetch(claim: ClaimRegistration | string): Promise<FarmResult> {
    const registration = typeof claim === 'string' ? this.claimFromString(claim) : claim;
    const startedAt = Date.now();
    const apiKey = this.requireApiKey();

    try {
      const payload = await this.requestJson<PerplexityResponse>(
        'https://api.perplexity.ai/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'user',
                content: `Summarize the latest evidence for: ${registration.query}`,
              },
            ],
          }),
        }
      );

      const content = payload.choices?.[0]?.message?.content?.trim();

      const sources = content
        ? [
            {
              url: 'https://www.perplexity.ai/',
              title: `Perplexity synthesis for ${registration.label}`,
              snippet: content,
              publishedAt: new Date().toISOString(),
              credibility: 0.75,
            },
          ]
        : [];

      return this.buildResult(registration, sources, startedAt);
    } catch (error) {
      if (error instanceof FarmConnectorError) {
        throw error;
      }

      throw new FarmConnectorError(this.name, 'Failed to fetch Perplexity synthesis', error);
    }
  }
}
