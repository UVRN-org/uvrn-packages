import { parseZoned } from './time';

/**
 * A citation (SPEC §3.1): where an input came from and when it was read. Every quote, case,
 * criterion, reference class, and the `asOf` instant carries one.
 */
export interface Citation {
  /** http(s) URL of the source. */
  url: string;
  /** Zoned ISO 8601 timestamp when the source was read. */
  accessedAt: string;
  /** Optional human label, e.g. "CPUC docket A.23-05-012". */
  label?: string;
}

/** citationProblem returns a reason string when the citation is unusable, else null. */
export function citationProblem(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'citation is missing';
  const c = value as Record<string, unknown>;
  if (typeof c.url !== 'string' || !/^https?:\/\/\S+$/.test(c.url)) {
    return 'citation.url must be an http(s) URL';
  }
  if (parseZoned(c.accessedAt) === null) {
    return 'citation.accessedAt must be an ISO 8601 timestamp with a timezone (Z or ±hh:mm)';
  }
  if (c.label !== undefined && typeof c.label !== 'string') return 'citation.label must be a string';
  return null;
}

/** copyCitation keeps only the declared citation members (unknown members are not echoed). */
export function copyCitation(c: Citation): Citation {
  const out: Citation = { url: c.url, accessedAt: c.accessedAt };
  if (c.label !== undefined) out.label = c.label;
  return out;
}
