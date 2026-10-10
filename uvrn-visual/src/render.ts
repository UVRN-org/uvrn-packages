import {
  VISUAL_PACKAGE_NAME,
  VISUAL_PACKAGE_VERSION,
  VISUAL_VARIANT,
  assertReceiptRef,
  escapeHtml,
  truncate,
  type VisualArtifact,
  type VisualReceiptInput,
} from './types';

const CSS = `
:root {
  --ink: #1a1a1a;
  --muted: #5c5c5c;
  --line: #d4d4d4;
  --paper: #f7f7f5;
  --accent: #2f5d50;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "IBM Plex Sans", "Source Sans 3", "Segoe UI", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(1200px 600px at 10% -10%, #e8efe9 0%, transparent 55%),
    linear-gradient(180deg, #fbfbf9 0%, var(--paper) 100%);
  min-height: 100vh;
}
main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}
.brand {
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 1.25rem;
}
h1 {
  font-family: "IBM Plex Serif", "Source Serif 4", Georgia, serif;
  font-weight: 600;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  line-height: 1.25;
  margin: 0 0 0.75rem;
}
.meta {
  display: grid;
  gap: 0.35rem;
  margin: 1.5rem 0;
  padding: 1rem 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  font-size: 0.92rem;
  color: var(--muted);
}
.meta strong { color: var(--ink); font-weight: 600; }
.narrative {
  font-size: 1.05rem;
  line-height: 1.55;
  margin: 1.25rem 0 0;
}
.ref {
  margin-top: 2.5rem;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.78rem;
  color: var(--muted);
  word-break: break-all;
}
.ref span { color: var(--ink); }
`.trim();

export function renderHtml(receipt: VisualReceiptInput): VisualArtifact {
  const receiptRef = assertReceiptRef(receipt);
  const renderedAt = new Date().toISOString();
  const title = truncate(receipt.claim.text || receipt.action || 'UVRN receipt', 160);
  const narrative = receipt.narrative
    ? `<p class="narrative">${escapeHtml(truncate(receipt.narrative, 500))}</p>`
    : '';
  const topic = receipt.topic
    ? `<div><strong>Topic</strong> ${escapeHtml(receipt.topic)}</div>`
    : '';

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="uvrn-receipt-ref" content="${escapeHtml(receiptRef)}" />
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <p class="brand">UVRN · plain view</p>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div><strong>Kind</strong> ${escapeHtml(receipt.kind)}</div>
    <div><strong>Claim</strong> ${escapeHtml(receipt.claim.id)}</div>
    <div><strong>Source</strong> ${escapeHtml(receipt.source)} · ${escapeHtml(receipt.action)}</div>
    <div><strong>Occurred</strong> ${escapeHtml(receipt.occurredAt)}</div>
    ${topic}
  </div>
  ${narrative}
  <p class="ref">receiptRef <span>${escapeHtml(receiptRef)}</span></p>
</main>
</body>
</html>`;

  return {
    format: 'html',
    contentType: 'text/html; charset=utf-8',
    body,
    receiptRef,
    renderedAt,
    renderer: {
      name: VISUAL_PACKAGE_NAME,
      version: VISUAL_PACKAGE_VERSION,
      variant: VISUAL_VARIANT,
    },
  };
}

export function renderSvg(receipt: VisualReceiptInput): VisualArtifact {
  const receiptRef = assertReceiptRef(receipt);
  const renderedAt = new Date().toISOString();
  const title = truncate(receipt.claim.text || receipt.action || 'UVRN receipt', 80);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" role="img" aria-label="${escapeHtml(title)}">
  <title>${escapeHtml(title)}</title>
  <desc>receiptRef ${escapeHtml(receiptRef)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbfbf9"/>
      <stop offset="100%" stop-color="#e8efe9"/>
    </linearGradient>
  </defs>
  <rect width="720" height="360" fill="url(#bg)"/>
  <text x="40" y="56" fill="#2f5d50" font-family="IBM Plex Sans, sans-serif" font-size="14" letter-spacing="2">UVRN · PLAIN VIEW</text>
  <text x="40" y="110" fill="#1a1a1a" font-family="IBM Plex Serif, Georgia, serif" font-size="28">${escapeHtml(title)}</text>
  <text x="40" y="160" fill="#5c5c5c" font-family="IBM Plex Sans, sans-serif" font-size="16">${escapeHtml(receipt.kind)} · ${escapeHtml(receipt.claim.id)}</text>
  <text x="40" y="196" fill="#5c5c5c" font-family="IBM Plex Sans, sans-serif" font-size="14">${escapeHtml(receipt.source)} · ${escapeHtml(receipt.action)}</text>
  <text x="40" y="232" fill="#5c5c5c" font-family="IBM Plex Sans, sans-serif" font-size="14">${escapeHtml(receipt.occurredAt)}</text>
  <text x="40" y="300" fill="#1a1a1a" font-family="ui-monospace, monospace" font-size="11">receiptRef ${escapeHtml(receiptRef)}</text>
</svg>`;

  return {
    format: 'svg',
    contentType: 'image/svg+xml; charset=utf-8',
    body,
    receiptRef,
    renderedAt,
    renderer: {
      name: VISUAL_PACKAGE_NAME,
      version: VISUAL_PACKAGE_VERSION,
      variant: VISUAL_VARIANT,
    },
  };
}
