// Public data contract for @uvrn/algox.
//
// A Candidate is whatever an agent gathered from the web. It is intentionally
// loose: the package only relies on a handful of well-known fields and passes
// everything else through untouched, so any dashboard can read its own fields
// back off the ranked output.

export interface Candidate {
  /** Optional stable identifier from the gathering agent. */
  id?: string;
  /** Human-readable name of the signal, e.g. "oversized blazers". Required. */
  label: string;
  /** Where the signal was seen. Used for dedup + diversity when present. */
  url?: string;
  /** Grouping key for the diversity cap, e.g. "vogue.com". */
  source?: string;
  /** How loud the signal is — any agent-provided number. */
  prominence?: number;
  /** ISO date the signal was observed. Used by the freshness filter. */
  observedAt?: string;
  /** Extra named numeric signals to blend into the score. */
  signals?: Record<string, number>;
  /** Agents may attach anything else; it is preserved on the output. */
  [k: string]: unknown;
}

export interface ScoredCandidate extends Candidate {
  /** Combined score assigned by a scorer. Higher ranks first. */
  score: number;
  /** Why a candidate was dropped, when applicable. */
  reason?: string;
}

export interface Warning {
  stage: string;
  code: string;
  detail?: string;
}

export interface PipelineQuery {
  candidates: Candidate[];
  /** Free-form config bag; presets attach the resolved config here. */
  config?: Record<string, unknown>;
}

/** Mutable state threaded through every stage. */
export interface Context {
  /** Working set; filters move items out of here into `dropped`. */
  candidates: ScoredCandidate[];
  dropped: ScoredCandidate[];
  /** Final ranked output, set by the selector. */
  selected: ScoredCandidate[] | null;
  warnings: Warning[];
  config: Record<string, unknown>;
  query: PipelineQuery;
}

/** A pipeline step. `enabled` lets a stage opt out for a given run. */
export interface Stage {
  name: string;
  enabled?(ctx: Context): boolean;
  run(ctx: Context): void | Promise<void>;
}

/** What any dashboard reads. Pure data, no UI coupling. */
export interface RankedResult {
  /** Top-K, highest score first. */
  ranked: ScoredCandidate[];
  /** Everything filtered out, each with a `reason`. */
  dropped: ScoredCandidate[];
  warnings: Warning[];
  /** The knobs actually used, echoed for transparency. */
  config: ResolvedConfig;
}

/** Caller-facing knobs for the `signals` preset. All optional. */
export interface SignalConfig {
  /** How many results to keep. Default 10. */
  topK?: number;
  /** Max candidates kept per `source`. Default 3. */
  capPerSource?: number;
  /** Drop signals older than this many days. `null` disables. Default 30. */
  maxAgeDays?: number | null;
  /** Weight per signal name blended into the score. Default { prominence: 1 }. */
  weights?: Record<string, number>;
  /** Reference "now" for freshness; defaults to the current time. */
  now?: string | Date;
}

/** SignalConfig with every default resolved to a concrete value. */
export interface ResolvedConfig {
  topK: number;
  capPerSource: number;
  maxAgeDays: number | null;
  weights: Record<string, number>;
  now: string;
}
