/**
 * Envelope construction: wrap existing protocol receipts (DeltaReceipt, MasterReceipt) into
 * NetworkReceipts per SPEC/uvrn-receipt-v1.md §3.1. Wrapping never mutates the payload — the
 * base receipt stays independently verifiable forever.
 */

import type { DeltaReceipt, MasterReceipt } from '@uvrn/core';
import { createHash } from 'crypto';
import { computeNetworkReceiptHash } from '../sign';
import { normalizeTopic } from '../topics';
import type { ClaimRef, NetworkReceipt, NetworkReceiptLink, ReceiptKind, SdkInfo, Topic } from '../types';
import { buildMasterNarrative } from '../vocabulary';

/**
 * claimIdFromText derives a stable, collision-safe claim id from claim text:
 * slug + 8-char sha256 suffix (the @uvrn/mcp convention).
 */
export function claimIdFromText(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const suffix = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 8);
  return `${slug || 'claim'}-${suffix}`;
}

/** Common envelope options shared by the wrap helpers. */
export interface WrapOptions {
  /** Claim text, or a full ClaimRef when the caller already holds a stable id. */
  claim: string | ClaimRef;
  source: string;
  action: string;
  /** Defaults to the payload's own timestamp where one exists. */
  occurredAt?: string;
  topic?: string | Topic;
  tags?: string[];
  narrative?: string;
  links?: NetworkReceiptLink[];
  chainId?: string;
  sdk?: SdkInfo;
}

function claimRef(claim: string | ClaimRef): ClaimRef {
  return typeof claim === 'string' ? { id: claimIdFromText(claim), text: claim } : claim;
}

function buildEnvelope(
  kind: ReceiptKind,
  payload: Record<string, unknown>,
  occurredAt: string,
  options: WrapOptions
): NetworkReceipt {
  const envelope: NetworkReceipt = {
    schemaVersion: 'uvrn-receipt-4',
    receiptHash: '',
    kind,
    claim: claimRef(options.claim),
    source: options.source,
    action: options.action,
    occurredAt,
    payload,
  };
  if (options.topic !== undefined) envelope.topic = normalizeTopic(options.topic).topic;
  if (options.tags !== undefined) envelope.tags = options.tags;
  if (options.narrative !== undefined) envelope.narrative = options.narrative;
  if (options.links !== undefined) envelope.links = options.links;
  if (options.chainId !== undefined) envelope.chainId = options.chainId;
  if (options.sdk !== undefined) envelope.sdk = options.sdk;
  envelope.receiptHash = computeNetworkReceiptHash(envelope);
  return envelope;
}

/**
 * wrapDeltaReceipt wraps a v3 DeltaReceipt byte-for-byte (including its own hash) into a
 * `kind: 'delta'` NetworkReceipt.
 */
export function wrapDeltaReceipt(delta: DeltaReceipt, options: WrapOptions): NetworkReceipt {
  const occurredAt = options.occurredAt ?? delta.ts;
  if (!occurredAt) {
    throw new TypeError('wrapDeltaReceipt: occurredAt is required when the delta receipt has no ts');
  }
  return buildEnvelope('delta', delta as unknown as Record<string, unknown>, occurredAt, options);
}

/**
 * wrapMasterReceipt wraps a MasterReceipt into a `kind: 'master'` NetworkReceipt.
 * `narrative` is required for masters (SPEC §3); when omitted it is generated from the
 * vocabulary template so even the raw stored narrative is human-first.
 */
export function wrapMasterReceipt(master: MasterReceipt, options: WrapOptions): NetworkReceipt {
  const occurredAt = options.occurredAt ?? master.ts;
  const narrative = options.narrative ?? defaultMasterNarrative(master, options);
  return buildEnvelope('master', master as unknown as Record<string, unknown>, occurredAt, {
    ...options,
    narrative,
  });
}

function defaultMasterNarrative(master: MasterReceipt, options: WrapOptions): string {
  const fired = master.measurements.find((m) =>
    ['agree', 'disagree', 'conflict', 'potential'].includes(m.verdict)
  );
  const primaryVerdict = fired?.verdict ?? master.measurements[0]?.verdict ?? 'insufficient-data';
  const responded = master.nodes.filter((node) => node.status === 'on').length;
  return buildMasterNarrative({
    claimText: claimRef(options.claim).text,
    primaryVerdict,
    sourcesTotal: master.nodes.length,
    sourcesResponded: responded,
  });
}
