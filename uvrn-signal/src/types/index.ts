export interface DriftThresholdEvent {
  claimId: string;
  status: 'DRIFTING' | 'CRITICAL';
  snapshot: {
    adjustedScore: number;
    freshness: number;
    decayRate: number;
    timestamp: number;
  };
}

export interface DriftStableEvent {
  claimId: string;
  snapshot: {
    adjustedScore: number;
    freshness: number;
    timestamp: number;
  };
}

export interface CanonSuggestionEvent {
  receiptId: string;
  claimId: string;
  reason: string;
  score: number;
}

export interface CanonizedEvent {
  receiptId: string;
  claimId: string;
  canonId: string;
  timestamp: number;
}

export interface AgentReceiptEvent {
  claimId: string;
  receipt: unknown;
}

export interface AgentRegisteredEvent {
  claimId: string;
  claim: string;
}

export interface AgentStoppedEvent {
  claimId?: string;
}

export interface WatchAlertEvent {
  claimId: string;
  status: 'DRIFTING' | 'CRITICAL';
  subscriberId: string;
}

export interface WatchCooldownEvent {
  claimId: string;
  subscriberId: string;
  nextAlertAt: number;
}

export interface UVRNEventMap {
  'drift:threshold': DriftThresholdEvent;
  'drift:stable': DriftStableEvent;
  'canon:suggested': CanonSuggestionEvent;
  'canon:canonized': CanonizedEvent;
  'agent:receipt': AgentReceiptEvent;
  'agent:registered': AgentRegisteredEvent;
  'agent:stopped': AgentStoppedEvent;
  'watch:alert': WatchAlertEvent;
  'watch:cooldown': WatchCooldownEvent;
}

export type SignalEventMap = object;
export type SignalEventKey<TEventMap extends SignalEventMap> = Extract<keyof TEventMap, string>;
export type SignalHandler<TEventMap extends SignalEventMap, TEvent extends SignalEventKey<TEventMap>> = (
  payload: TEventMap[TEvent]
) => void;
