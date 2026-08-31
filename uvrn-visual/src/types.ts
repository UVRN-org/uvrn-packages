/**
 * @uvrn/visual — plain-default receipt views.
 * No hash/sign/verify logic here (wall 5 — picture is never the proof).
 */

export const VISUAL_PACKAGE_NAME = '@uvrn/visual';
export const VISUAL_PACKAGE_VERSION = '5.0.0';
export const VISUAL_VARIANT = 'plain-default' as const;

/** Minimal receipt-shaped input — structural subset of NetworkReceipt. */
export interface VisualReceiptInput {
  receiptHash: string;
  kind: string;
  claim: { id: string; text: string };
  source: string;
  action: string;
  occurredAt: string;
  topic?: string;
  narrative?: string;
  payload?: Record<string, unknown>;
}

export interface VisualRendererInfo {
  name: typeof VISUAL_PACKAGE_NAME;
  version: string;
  variant: typeof VISUAL_VARIANT;
}

export interface VisualArtifact {
  format: 'html' | 'svg';
  contentType: string;
  body: string;
  /** MUST equal receipt.receiptHash — wall 5. */
  receiptRef: string;
  renderedAt: string;
  renderer: VisualRendererInfo;
}

export function assertReceiptRef(receipt: VisualReceiptInput): string {
  const ref = receipt.receiptHash?.trim();
  if (!ref) {
    throw new Error('@uvrn/visual: receiptHash required (receiptRef / wall 5)');
  }
  return ref;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
