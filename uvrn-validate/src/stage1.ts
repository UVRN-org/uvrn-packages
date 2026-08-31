import type { DataPoint, Stage1Token } from './types';

export type Stage1Check = {
  token: Stage1Token;
  reasons: string[];
};

/**
 * Stage1: shape/presence only.
 * Emits structurally-ok | malformed — never integrity-checked or verified.
 */
export function checkDataPointShape(input: unknown): Stage1Check {
  const reasons: string[] = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      token: 'malformed',
      reasons: ['DataPoint must be a non-null object'],
    };
  }

  const point = input as Partial<DataPoint>;

  if (typeof point.id !== 'string' || point.id.trim().length === 0) {
    reasons.push('id must be a non-empty string');
  }
  if (typeof point.kind !== 'string' || point.kind.trim().length === 0) {
    reasons.push('kind must be a non-empty string');
  }
  if (!('value' in point)) {
    reasons.push('value is required (presence check)');
  }
  if (point.sourceRef !== undefined && typeof point.sourceRef !== 'string') {
    reasons.push('sourceRef must be a string when provided');
  }

  if (reasons.length > 0) {
    return { token: 'malformed', reasons };
  }

  return { token: 'structurally-ok', reasons: [] };
}
