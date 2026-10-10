/**
 * Topic taxonomy per SPEC/uvrn-receipt-v1.md §4: controlled starter domains plus an open
 * `custom/` extension. Validation normalizes; it never rejects — recorded, not hidden.
 */

import type { Topic } from '../types';

/** The controlled starter domains (decision D-4). */
export const STARTER_DOMAINS = ['markets', 'products', 'news', 'research', 'claims'] as const;

const SEGMENT_PATTERN = /^[a-z0-9-]+$/;

function sanitizeSegment(segment: string, preserveCase = false): string {
  const trimmed = preserveCase ? segment.trim() : segment.trim().toLowerCase();
  const cleaned = trimmed.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned;
}

/**
 * parseTopic splits a serialized topic string into its structured form.
 * Extra segments beyond the third are folded into `instrument`.
 */
export function parseTopic(serialized: string): Topic {
  const segments = serialized.split('/').filter((segment) => segment.length > 0);
  const [domain = '', subject, ...rest] = segments;
  const topic: Topic = { domain };
  if (subject) topic.subject = subject;
  if (rest.length > 0) topic.instrument = rest.join('/');
  return topic;
}

/** formatTopic serializes a structured Topic to its `domain[/subject[/instrument]]` string. */
export function formatTopic(topic: Topic): string {
  const segments = [topic.domain];
  if (topic.subject) segments.push(topic.subject);
  if (topic.instrument) segments.push(topic.instrument);
  return segments.join('/');
}

/**
 * NormalizedTopic reports the accepted serialized form plus whether normalization changed it.
 */
export interface NormalizedTopic {
  topic: string;
  /** True when the input was rewritten (sanitized segments or moved under `custom/`). */
  normalized: boolean;
}

/**
 * normalizeTopic accepts any topic (string or structured) and returns the canonical serialized
 * form. Unknown domains are preserved under `custom/`; nothing is ever rejected.
 */
export function normalizeTopic(input: string | Topic): NormalizedTopic {
  const raw = typeof input === 'string' ? parseTopic(input) : input;
  const domain = sanitizeSegment(raw.domain ?? '');
  const subject = raw.subject ? sanitizeSegment(raw.subject) : undefined;
  const instrument = raw.instrument ? sanitizeSegment(raw.instrument, true) : undefined;

  let segments: string[];
  if (!domain) {
    segments = ['custom', 'unspecified'];
  } else if ((STARTER_DOMAINS as readonly string[]).includes(domain) || domain === 'custom') {
    segments = [domain];
  } else {
    segments = ['custom', domain];
  }
  if (subject) segments.push(subject);
  if (instrument) segments.push(instrument);

  const topic = segments.join('/');
  const original = typeof input === 'string' ? input : formatTopic(input);
  return { topic, normalized: topic !== original };
}

/**
 * isValidTopicString checks that a serialized topic is already in canonical form
 * (starter or custom domain, sanitized segments). Use normalizeTopic to repair, not reject.
 */
export function isValidTopicString(serialized: string): boolean {
  if (typeof serialized !== 'string' || serialized.length === 0) return false;
  const segments = serialized.split('/');
  if (segments.some((segment) => segment.length === 0)) return false;
  const [domain, ...rest] = segments;
  const domainOk =
    (STARTER_DOMAINS as readonly string[]).includes(domain) || domain === 'custom';
  if (!domainOk || !SEGMENT_PATTERN.test(domain)) return false;
  // Instrument (last segment) may carry uppercase by ticker convention.
  return rest.every((segment, index) =>
    index === rest.length - 1 ? /^[a-zA-Z0-9-]+$/.test(segment) : SEGMENT_PATTERN.test(segment)
  );
}
