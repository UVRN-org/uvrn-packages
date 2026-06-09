import type { DataSpec, MetricPoint } from '@uvrn/core';

import type { DomainResult, DomainSignal, NormalizedDomainBundle } from '../types';

export function normalizeDomainSignals(
  domainId: string,
  label: string,
  signals: DomainSignal[]
): NormalizedDomainBundle {
  const metrics = signals.map(toMetricPoint);
  const score = average(metrics.map((metric) => metric.value));
  const originDocIds = unique(signals.map((signal) => signal.source));
  const status = signals.length === 0 ? 'empty' : 'ok';

  const dataSpec: DataSpec = {
    id: `domain-${domainId}`,
    label,
    sourceKind: 'metric',
    originDocIds,
    metrics,
  };

  const result: DomainResult = {
    domainId,
    signals,
    score,
    status,
    explanation: `${label} produced ${signals.length} normalized numeric signal(s) for lattice comparison.`,
  };

  return { dataSpec, result };
}

function toMetricPoint(signal: DomainSignal): MetricPoint {
  return {
    key: signal.key,
    value: signal.value,
    unit: signal.unit,
    ts: signal.ts,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}
