import {
  MockReportUploadTransport,
  fromTimelineChartData,
  renderChartHtml,
  renderChartSvg,
  uploadChartReport,
  type ChartSeriesInput,
} from '../src';

const sample: ChartSeriesInput = {
  seriesId: 'series-btc-drift-1',
  claimId: 'claim-btc-1',
  title: 'BTC short-horizon drift',
  points: [
    {
      t: '2026-07-01T00:00:00.000Z',
      v: 0.42,
      status: 'watch',
      receiptHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      t: '2026-07-08T00:00:00.000Z',
      v: 0.51,
      status: 'stable',
      receiptHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    {
      t: '2026-07-15T00:00:00.000Z',
      v: 0.47,
      status: 'stable',
      receiptHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
  ],
  markers: [
    {
      t: '2026-07-08T00:00:00.000Z',
      label: 'canon',
      receiptHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    },
  ],
};

describe('@uvrn/chart-memory plain-default', () => {
  test('renderChartSvg embeds seriesRef and receiptRefs', () => {
    const art = renderChartSvg(sample);
    expect(art.format).toBe('svg');
    expect(art.seriesRef).toBe(sample.seriesId);
    expect(art.receiptRefs).toEqual(
      expect.arrayContaining([
        sample.points[0].receiptHash,
        sample.points[1].receiptHash,
        sample.points[2].receiptHash,
        sample.markers![0].receiptHash,
      ]),
    );
    expect(art.body).toContain(sample.seriesId);
    expect(art.body).toContain('<svg');
    expect(art.body).toContain('seriesRef');
    expect(art.renderer.variant).toBe('plain-default');
  });

  test('renderChartHtml embeds seriesRef meta', () => {
    const art = renderChartHtml(sample);
    expect(art.format).toBe('html');
    expect(art.body).toContain(`content="${sample.seriesId}"`);
    expect(art.body).toContain(sample.seriesId);
  });

  test('missing seriesId throws', () => {
    expect(() => renderChartSvg({ ...sample, seriesId: '' })).toThrow(/seriesId required/);
  });

  test('no receiptHashes and no historyRef throws (wall 5)', () => {
    const bare: ChartSeriesInput = {
      seriesId: 's1',
      claimId: 'c1',
      points: [{ t: '2026-07-01T00:00:00.000Z', v: 1 }],
    };
    expect(() => renderChartSvg(bare)).toThrow(/historyRef/);
  });

  test('historyRef-only series renders', () => {
    const hist: ChartSeriesInput = {
      seriesId: 's-hist',
      claimId: 'c1',
      historyRef: 'hist:fixture-1',
      points: [
        { t: '2026-07-01T00:00:00.000Z', v: 1 },
        { t: '2026-07-02T00:00:00.000Z', v: 2 },
      ],
    };
    const art = renderChartSvg(hist);
    expect(art.historyRef).toBe('hist:fixture-1');
    expect(art.receiptRefs).toEqual([]);
    expect(art.body).toContain('hist:fixture-1');
  });

  test('fromTimelineChartData adapter maps ChartData-like shape', () => {
    const series = fromTimelineChartData(
      {
        labels: ['2026-07-01', '2026-07-02'],
        vScores: [0.1, 0.2],
        statuses: ['a', 'b'],
        canonMarkers: [{ index: 1, label: 'canon', timestamp: '2026-07-02' }],
      },
      { seriesId: 's-tl', claimId: 'c-tl', historyRef: 'hist:tl' },
    );
    const art = renderChartSvg(series);
    expect(art.seriesRef).toBe('s-tl');
    expect(art.body).toContain('canon');
  });

  test('uploadChartReport uses mock transport + STORE-REPORT-R2 path', async () => {
    const art = renderChartSvg(sample);
    const transport = new MockReportUploadTransport();
    const result = await uploadChartReport(art, transport, { reportId: 'rep-chart-1' });
    expect(result.location).toContain('reports/rep-chart-1');
    expect(result.seriesRef).toBe(sample.seriesId);
    expect(result.receiptRef).toBe(sample.points[0].receiptHash);
    expect(transport.uploads[0].path).toBe('/v1/reports/upload');
  });

  test('hygiene: no cloudflare/d1/wrangler in package source', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const srcDir = path.join(__dirname, '..', 'src');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    const joined = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
    const lower = joined.toLowerCase();
    // Wall 4 one-door: package src must not bind D1 or import store-d1-client.
    expect(lower).not.toMatch(/from ['"]cloudflare/);
    expect(lower).not.toMatch(/@cloudflare/);
    expect(lower).not.toMatch(/wrangler/);
    expect(joined).not.toMatch(/\bD1Database\b/);
    expect(lower).not.toMatch(/@uvrn\/store-d1-client/);
    expect(lower).not.toMatch(/store-d1(?:-client)?/);
    expect(lower).not.toMatch(/(?:^|['"/@])d1(?:['"/]|$)/m);
    expect(lower).not.toMatch(/\bd1\b/);
  });
});
