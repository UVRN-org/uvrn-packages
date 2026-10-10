import {
  MockReportUploadTransport,
  renderHtml,
  renderSvg,
  uploadVisualReport,
  type VisualReceiptInput,
} from '../src';

const sample: VisualReceiptInput = {
  receiptHash: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  kind: 'delta',
  claim: { id: 'claim-btc-1', text: 'BTC short-horizon drift stayed within band' },
  source: 'uvrn-sdk',
  action: 'delta.consensus',
  occurredAt: '2026-07-21T18:00:00.000Z',
  topic: 'markets/crypto/BTC',
  narrative: 'Fixture narrative for plain visual render.',
};

describe('@uvrn/visual plain-default', () => {
  test('renderHtml embeds receiptRef and meta', () => {
    const art = renderHtml(sample);
    expect(art.format).toBe('html');
    expect(art.receiptRef).toBe(sample.receiptHash);
    expect(art.body).toContain(`content="${sample.receiptHash}"`);
    expect(art.body).toContain('receiptRef');
    expect(art.body).toContain(sample.receiptHash);
    expect(art.body).toContain(sample.claim.text);
    expect(art.renderer.variant).toBe('plain-default');
  });

  test('renderSvg embeds receiptRef', () => {
    const art = renderSvg(sample);
    expect(art.format).toBe('svg');
    expect(art.receiptRef).toBe(sample.receiptHash);
    expect(art.body).toContain(sample.receiptHash);
    expect(art.body).toContain('<svg');
  });

  test('missing receiptHash throws (wall 5)', () => {
    expect(() =>
      renderHtml({ ...sample, receiptHash: '' }),
    ).toThrow(/receiptHash required/);
  });

  test('uploadVisualReport uses mock transport + STORE-REPORT-R2 path', async () => {
    const art = renderHtml(sample);
    const transport = new MockReportUploadTransport();
    const result = await uploadVisualReport(art, transport, { reportId: 'rep-visual-1' });
    expect(result.location).toContain('reports/rep-visual-1');
    expect(result.receiptRef).toBe(sample.receiptHash);
    expect(transport.uploads[0].path).toBe('/v1/reports/upload');
    const body = transport.uploads[0].body as { receiptRef: string; content: string };
    expect(body.receiptRef).toBe(sample.receiptHash);
    expect(body.content).toContain('receiptRef');
  });

  test('hygiene: no cloudflare/d1/wrangler in package source', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const srcDir = path.join(__dirname, '..', 'src');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    const joined = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
    expect(joined.toLowerCase()).not.toMatch(/from ['"]cloudflare/);
    expect(joined.toLowerCase()).not.toMatch(/@cloudflare/);
    expect(joined.toLowerCase()).not.toMatch(/wrangler/);
    // allow the word "D1" only if absent — package must not bind D1
    expect(joined).not.toMatch(/\bD1Database\b/);
  });
});
