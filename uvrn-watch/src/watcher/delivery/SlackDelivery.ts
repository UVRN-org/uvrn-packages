import type { AlertEvent, DeliveryTarget } from '../../types';

export class SlackDelivery implements DeliveryTarget {
  constructor(private readonly webhookUrl: string) {}

  async deliver(event: AlertEvent): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: event.summary }),
    });

    if (!response.ok) {
      throw new Error(`Slack delivery failed with status ${response.status}`);
    }
  }
}
