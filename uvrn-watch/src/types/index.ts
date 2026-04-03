import type { DriftStatus, DriftThresholdEvent } from '@uvrn/drift';

export type AlertStatus = Extract<DriftStatus, 'DRIFTING' | 'CRITICAL'>;
export type AlertMode = 'once' | 'every';

export interface DeliveryTarget {
  deliver(event: AlertEvent): Promise<void>;
}

export interface NotifyTargets {
  callback?: (event: AlertEvent) => void;
  webhook?: string;
  slack?: string;
  discord?: string;
  targets?: DeliveryTarget | DeliveryTarget[];
}

export interface SubscribeOptions {
  on: AlertStatus | AlertStatus[];
  notify: NotifyTargets;
  mode?: AlertMode;
  cooldown?: number;
}

export interface AlertEvent {
  claimId: string;
  status: AlertStatus;
  vScore: number;
  driftDelta: number;
  triggeredAt: string;
  subscriberId: string;
  summary: string;
}

export interface WatcherOptions {
  agent: unknown;
}

export interface Subscription {
  claimId: string;
  options: SubscribeOptions;
  subscriberId: string;
  lastAlertAt?: number;
  alertCount: number;
  active: boolean;
}

export interface ThresholdAgent {
  on(event: 'claim:threshold', listener: (event: DriftThresholdEvent) => void): unknown;
  off?(event: 'claim:threshold', listener: (event: DriftThresholdEvent) => void): unknown;
  removeListener?(event: 'claim:threshold', listener: (event: DriftThresholdEvent) => void): unknown;
}
