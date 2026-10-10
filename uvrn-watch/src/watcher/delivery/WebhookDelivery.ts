import type { AlertEvent, DeliveryTarget } from '../../types';

export class WebhookDelivery implements DeliveryTarget {
  constructor(private readonly url: string) {}

  async deliver(event: AlertEvent): Promise<void> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }
  }
}
