/**
 * Measurement contract types describe pluggable relationship checks over evidence.
 * Core owns the shared shape only; measurement logic lives in packages such as `@uvrn/measure`.
 */
export type MeasurementType = 'agree' | 'disagree' | 'conflict' | 'potential' | (string & {});
/**
 * NodeStatus records whether a participating evidence node was reachable for a measurement run.
 * Offline or unavailable nodes are explicit receipt facts, not hidden omissions.
 */
export type NodeStatus = 'on' | 'off' | 'unavailable';
/**
 * MeasurementRange is a numeric interval asserted by a source.
 * Range measurements can use it to detect disjoint claims without treating all numeric spread as conflict.
 */
export interface MeasurementRange {
    /** Lowest value included in the asserted range. */
    min: number;
    /** Highest value included in the asserted range. */
    max: number;
}
/**
 * MeasurementSource is one piece of evidence supplied to a measurement module.
 * It supports numeric, categorical, boolean, and range-style assertions while remaining provider-neutral.
 */
export interface MeasurementSource {
    /** Stable source identifier used in measurement evidence references. */
    id: string;
    /** Evidence kind that explains how `value`, `assertion`, or `range` should be interpreted. */
    kind?: 'numeric' | 'categorical' | 'boolean' | 'range';
    /** Numeric evidence value for convergence or divergence checks. */
    value?: number;
    /** Categorical or boolean assertion text for direct contradiction checks. */
    assertion?: string;
    /** Numeric range assertion for overlap and disjoint-range checks. */
    range?: MeasurementRange;
    /** Provider-neutral provenance or extra evidence fields. */
    attributes?: Record<string, unknown>;
    /** Human-readable source label for explanations. */
    label?: string;
    /** ISO timestamp for evidence observed over time. */
    ts?: string;
    /** Reachability state for the source when the evidence was collected. */
    status?: NodeStatus;
}
/**
 * MeasurementInput is the claim evidence bundle passed into one measurement module.
 * Optional context carries measurement-defined thresholds or profiles without introducing provider coupling.
 */
export interface MeasurementInput {
    /** Claim being measured. */
    claim: string;
    /** Evidence sources available to the measurement. */
    sources: ReadonlyArray<MeasurementSource>;
    /** Measurement-defined runtime options such as thresholds or profile names. */
    context?: Record<string, unknown>;
}
/**
 * MeasurementResult is the relationship verdict emitted by one measurement module.
 * Results are intentionally short and factual so they can be embedded in receipts or LLM-facing tools.
 */
export interface MeasurementResult {
    /** Measurement type that produced this result. */
    type: MeasurementType;
    /** Measurement-defined outcome such as `agree`, `conflict`, or `none`. */
    verdict: string;
    /** Confidence in the verdict, normalized from 0 to 1. */
    confidence: number;
    /** Plain-language explanation of the evidence relationship. */
    explanation: string;
    /** Source ids that drove the verdict. */
    evidenceRefs: string[];
}
/**
 * Measurement is the protocol contract every relationship module implements.
 * The `evaluate` method is pure measurement logic over caller-supplied evidence.
 */
export interface Measurement {
    /** Stable type name used by registries and receipt consumers. */
    readonly type: MeasurementType;
    /** Evaluates the relationship state of the supplied evidence. */
    evaluate(input: MeasurementInput): MeasurementResult;
}
