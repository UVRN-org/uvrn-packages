/**
 * Loosechain Layer 1: Delta Engine Core - Types
 * These types constitute the "Protocol Law" and must remain stable.
 */
export interface MetricPoint {
    key: string;
    value: number;
    unit?: string;
    ts?: string;
}
export interface DataSpec {
    id: string;
    label: string;
    sourceKind: 'report' | 'metric' | 'chart' | 'meta';
    originDocIds: string[];
    metrics: MetricPoint[];
}
export interface DeltaBundle {
    bundleId: string;
    claim: string;
    dataSpecs: DataSpec[];
    thresholdPct: number;
    maxRounds?: number;
}
export interface DeltaRound {
    round: number;
    deltasByMetric: Record<string, number>;
    withinThreshold: boolean;
    witnessRequired: boolean;
    notes?: string[];
}
export type Outcome = 'consensus' | 'indeterminate';
export interface DeltaReceipt {
    bundleId: string;
    deltaFinal: number;
    sources: string[];
    rounds: DeltaRound[];
    suggestedFixes: [];
    outcome: Outcome;
    ts?: string;
    hash: string;
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export interface VerifyResult {
    verified: boolean;
    recomputedHash?: string;
    error?: string;
}
export interface EngineOpts {
    timestamp?: string;
}
