/**
 * toHumanView per SPEC plan B4: a pure function from NetworkReceipt to a structured,
 * UI-agnostic human representation. Any renderer — React, plain HTML, CLI, PDF — can present
 * the result without understanding the protocol. All strings come from the vocabulary module.
 */

import type {
  HumanMeasurement,
  HumanScoreCard,
  HumanSource,
  HumanView,
  NetworkReceipt,
  VerdictTone,
} from '../types';
import {
  framingFor,
  SCORE_PLAIN_MEANING,
  SOURCE_STATUS_NOTES,
  verdictHuman,
} from '../vocabulary';

interface MeasurementLike {
  type?: unknown;
  verdict?: unknown;
  confidence?: unknown;
  explanation?: unknown;
  humanExplanation?: unknown;
}

interface NodeLike {
  id?: unknown;
  status?: unknown;
  detail?: unknown;
}

/** Optional facts the producing surface can add to the human view. */
export interface HumanViewOptions {
  /** V-Score and components when the surface computed them (0–100 / 0–1 respectively). */
  scores?: { vScore?: number; completeness?: number; parity?: number; freshness?: number };
  /** Base URL for the public receipt page; default is the uvrn.org portal. */
  verifyBaseUrl?: string;
  /** Registry timestamp when known. */
  registeredAt?: string;
}

const DEFAULT_VERIFY_BASE = 'https://uvrn.org/access/receipt/';

/** Tone precedence when summarizing many measurements into one headline verdict. */
const TONE_PRIORITY: VerdictTone[] = ['contradiction', 'split', 'aligned', 'early-signal', 'insufficient'];

/**
 * toHumanView renders any NetworkReceipt. Master receipts get the full evidence story;
 * other kinds get an honest summary of what the envelope itself can prove.
 */
export function toHumanView(receipt: NetworkReceipt, options: HumanViewOptions = {}): HumanView {
  const measurements = readMeasurements(receipt);
  const sources = readSources(receipt);

  const fired = measurements.filter((m) =>
    ['agree', 'disagree', 'conflict', 'potential'].includes(m.verdict)
  );
  const primary =
    fired
      .map((m) => verdictHuman(m.verdict))
      .sort((a, b) => TONE_PRIORITY.indexOf(a.tone) - TONE_PRIORITY.indexOf(b.tone))[0] ??
    verdictHuman(measurements.length > 0 ? 'insufficient-data' : receipt.kind);

  const responding = sources.filter((s) => s.status === 'on').length;
  const headline =
    sources.length > 0
      ? `${responding} of ${sources.length} sources weighed in — ${primary.label.toLowerCase()}`
      : receipt.narrative ?? primary.label;

  const gaps = sources
    .filter((s) => s.status !== 'on')
    .map((s) => ({
      what: `Source ${s.name} was ${s.status === 'off' ? 'switched off' : 'unreachable'}`,
      plainNote: SOURCE_STATUS_NOTES[s.status],
    }));

  return {
    headline,
    verdictLabel: primary.label,
    verdictTone: primary.tone,
    claim: receipt.claim.text,
    scoreCard: scoreCard(options),
    sources,
    measurements,
    gaps,
    provenance: {
      hash: receipt.receiptHash,
      signed: receipt.signature !== undefined,
      signerRef: receipt.signature?.publicKeyRef,
      registeredAt: options.registeredAt,
      verifyUrl: `${options.verifyBaseUrl ?? DEFAULT_VERIFY_BASE}${receipt.receiptHash}`,
    },
    howToVerify: howToVerify(receipt),
  };
}

function scoreCard(options: HumanViewOptions): HumanScoreCard {
  return {
    vScore: options.scores?.vScore,
    completeness: options.scores?.completeness,
    parity: options.scores?.parity,
    freshness: options.scores?.freshness,
    plainMeaning: {
      vScore: SCORE_PLAIN_MEANING.vScore,
      completeness: SCORE_PLAIN_MEANING.completeness,
      parity: SCORE_PLAIN_MEANING.parity,
      freshness: SCORE_PLAIN_MEANING.freshness,
    },
  };
}

function readMeasurements(receipt: NetworkReceipt): HumanMeasurement[] {
  const raw = (receipt.payload as { measurements?: unknown }).measurements;
  if (!Array.isArray(raw)) return [];
  const topicDomain = receipt.topic?.split('/')[0];
  return raw
    .filter((item): item is MeasurementLike => typeof item === 'object' && item !== null)
    .map((item) => {
      const verdict = typeof item.verdict === 'string' ? item.verdict : 'insufficient-data';
      const human = verdictHuman(verdict);
      const explanation =
        typeof item.humanExplanation === 'string'
          ? item.humanExplanation
          : typeof item.explanation === 'string'
            ? item.explanation
            : human.meaning;
      return {
        type: typeof item.type === 'string' ? item.type : 'unknown',
        verdict,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        plainExplanation: explanation,
        whyItMatters: framingFor(topicDomain, human.tone) || human.meaning,
      };
    });
}

function readSources(receipt: NetworkReceipt): HumanSource[] {
  const nodes = (receipt.payload as { nodes?: unknown }).nodes;
  if (Array.isArray(nodes)) {
    return nodes
      .filter((node): node is NodeLike => typeof node === 'object' && node !== null)
      .map((node) => {
        const status = node.status === 'off' || node.status === 'unavailable' ? node.status : 'on';
        return {
          name: typeof node.id === 'string' ? node.id : 'unknown',
          status,
          contribution: typeof node.detail === 'string' ? node.detail : undefined,
          plainNote: SOURCE_STATUS_NOTES[status],
        };
      });
  }
  // Delta receipts carry source labels only; report them as responding sources.
  const deltaSources = (receipt.payload as { sources?: unknown }).sources;
  if (Array.isArray(deltaSources)) {
    return deltaSources
      .filter((label): label is string => typeof label === 'string')
      .map((label) => ({ name: label, status: 'on' as const, plainNote: SOURCE_STATUS_NOTES.on }));
  }
  return [];
}

function howToVerify(receipt: NetworkReceipt): string {
  const signedPart = receipt.signature
    ? 'then check the Ed25519 signature against the producer key referenced by ' +
      `"${receipt.signature.publicKeyRef}" (resolve it via /.well-known/uvrn-keys.json)`
    : 'this receipt is integrity-checked only (no producer signature), so the hash check is the whole story';
  return (
    'Recompute the SHA-256 hash over the declared field list (SPEC/uvrn-receipt-v1.md §2.4) ' +
    `and compare it to ${receipt.receiptHash}; ${signedPart}. ` +
    `CLI: npx @uvrn/cli verify-receipt receipt.json`
  );
}
