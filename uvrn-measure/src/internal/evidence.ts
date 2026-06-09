/**
 * Internal evidence helpers normalize thresholds, labels, fields, and agreement math for starter measurements.
 * They are not exported because hosts should extend UVRN by registering measurements, not by depending on internals.
 */

import type { MeasurementInput, MeasurementSource } from '@uvrn/core';
import type { PotentialHistoryPoint } from '../types';

const DEFAULT_AGREE_THRESHOLD = 0.9;
const DEFAULT_DIVERGENCE_THRESHOLD = 0.1;

interface NumericStats {
  score: number;
  spread: number;
  refs: string[];
}

export function sourceLabel(source: MeasurementSource): string {
  return source.label ?? source.id;
}

export function contextNumber(input: MeasurementInput, key: string, fallback: number): number {
  const value = input.context?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function agreeThreshold(input: MeasurementInput): number {
  return contextNumber(input, 'agreeThreshold', DEFAULT_AGREE_THRESHOLD);
}

export function divergenceThreshold(input: MeasurementInput): number {
  return contextNumber(input, 'divergenceThreshold', DEFAULT_DIVERGENCE_THRESHOLD);
}

export function numericSources(input: MeasurementInput): MeasurementSource[] {
  return input.sources.filter((source) => typeof source.value === 'number' && Number.isFinite(source.value));
}

export function numericAgreement(input: MeasurementInput): NumericStats | undefined {
  const sources = numericSources(input);
  if (sources.length < 2) {
    return undefined;
  }

  const values = sources.map((source) => source.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = (Math.abs(min) + Math.abs(max)) / 2;
  const spread = midpoint === 0 ? 0 : Math.abs(max - min) / midpoint;
  const score = Math.max(0, Math.min(1, 1 - spread));

  return {
    score,
    spread,
    refs: sources.map((source) => source.id),
  };
}

export function assertionSources(input: MeasurementInput): MeasurementSource[] {
  return input.sources.filter((source) => typeof source.assertion === 'string' && source.assertion.length > 0);
}

export function assertionAgreement(input: MeasurementInput): NumericStats | undefined {
  const sources = assertionSources(input);
  if (sources.length < 2) {
    return undefined;
  }

  const first = normalizeAssertion(sources[0].assertion);
  const allMatch = sources.every((source) => normalizeAssertion(source.assertion) === first);

  return {
    score: allMatch ? 1 : 0,
    spread: allMatch ? 0 : 1,
    refs: sources.map((source) => source.id),
  };
}

export function bestAgreement(input: MeasurementInput): NumericStats | undefined {
  return numericAgreement(input) ?? assertionAgreement(input);
}

export function normalizeAssertion(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function fieldKey(source: MeasurementSource): string {
  const field = source.attributes?.field ?? source.attributes?.key ?? source.attributes?.metric;
  return typeof field === 'string' && field.length > 0 ? field : 'default';
}

export function parseHistory(input: MeasurementInput): PotentialHistoryPoint[] {
  const value = input.context?.history ?? input.context?.agreementHistory;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): PotentialHistoryPoint | undefined => {
      if (typeof item === 'number' && Number.isFinite(item)) {
        return { score: item };
      }
      if (item && typeof item === 'object') {
        const candidate = item as Record<string, unknown>;
        if (typeof candidate.score === 'number' && Number.isFinite(candidate.score)) {
          return {
            score: candidate.score,
            ts: typeof candidate.ts === 'string' ? candidate.ts : undefined,
          };
        }
      }
      return undefined;
    })
    .filter((item): item is PotentialHistoryPoint => item !== undefined);
}

export function isMonotonicRising(values: number[]): boolean {
  if (values.length < 2) {
    return false;
  }
  const nonDecreasing = values.every((value, index) => index === 0 || value >= values[index - 1]);
  return nonDecreasing && values[values.length - 1] > values[0];
}
