import { buildExplanation } from './explanation';
import { WEIGHTS } from '../types';
import type {
  ComponentBreakdown,
  ScoringProfile,
  ScoreBreakdownResult,
  ScoreInputComponents,
} from '../types';

function round(value: number): number {
  return Number(value.toFixed(1));
}

function applyWeight(raw: number, weight: number): number {
  const weightPercent = Math.round(weight * 100);
  return round((raw * weightPercent) / 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function extractComponents(receipt: unknown): ScoreInputComponents {
  if (!isRecord(receipt)) {
    throw new Error('[ScoreBreakdown] receipt must be an object-like value');
  }

  const direct = {
    completeness: readNumber(receipt.completeness),
    parity: readNumber(receipt.parity),
    freshness: readNumber(receipt.freshness),
  };

  if (direct.completeness !== null && direct.parity !== null && direct.freshness !== null) {
    return {
      completeness: direct.completeness,
      parity: direct.parity,
      freshness: direct.freshness,
    };
  }

  const nested = isRecord(receipt.components) ? receipt.components : null;
  if (nested) {
    const completeness = readNumber(nested.completeness);
    const parity = readNumber(nested.parity);
    const freshness = readNumber(nested.freshness);

    if (completeness !== null && parity !== null && freshness !== null) {
      return { completeness, parity, freshness };
    }
  }

  throw new Error('[ScoreBreakdown] could not extract completeness, parity, and freshness');
}

function buildComponent(raw: number, weight: number): ComponentBreakdown {
  return {
    raw,
    weight,
    weighted: applyWeight(raw, weight),
  };
}

export class ScoreBreakdown implements ScoreBreakdownResult {
  readonly completeness: ComponentBreakdown;
  readonly parity: ComponentBreakdown;
  readonly freshness: ComponentBreakdown;
  readonly final: number;
  readonly explanation: string;
  readonly profile: string;

  constructor(receipt: unknown, profile: ScoringProfile) {
    const components = extractComponents(receipt);

    this.completeness = buildComponent(components.completeness, WEIGHTS.completeness);
    this.parity = buildComponent(components.parity, WEIGHTS.parity);
    this.freshness = buildComponent(components.freshness, WEIGHTS.freshness);
    this.final = round(
      this.completeness.weighted + this.parity.weighted + this.freshness.weighted
    );
    this.profile = profile.name;
    this.explanation = buildExplanation(this.toJSONWithoutExplanation(), profile);
  }

  toJSON(): ScoreBreakdownResult {
    return {
      ...this.toJSONWithoutExplanation(),
      explanation: this.explanation,
    };
  }

  private toJSONWithoutExplanation(): ScoreBreakdownResult {
    return {
      completeness: this.completeness,
      parity: this.parity,
      freshness: this.freshness,
      final: this.final,
      explanation: '',
      profile: this.profile,
    };
  }
}
