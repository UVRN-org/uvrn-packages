/**
 * Optional report upload helper — talks to STORE-REPORT-R2 paths via injectable transport.
 * Fixture tests never load live worker credentials.
 */

import type { ChartArtifact } from './types';

export interface ReportUploadTransport {
  request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; error?: string; body?: T }>;
}

export interface ReportUploadResult {
  location: string;
  reportId: string;
  receiptRef?: string;
  seriesRef: string;
  written_at?: string;
  checksum?: string;
}

export async function uploadChartReport(
  artifact: ChartArtifact,
  transport: ReportUploadTransport,
  options?: { reportId?: string },
): Promise<ReportUploadResult> {
  const reportId =
    options?.reportId ??
    `chart-${artifact.format}-${artifact.seriesRef.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 80)}`;

  const receiptRef = artifact.receiptRefs[0];

  const res = await transport.request<{
    location?: string;
    reportId?: string;
    receiptRef?: string;
    written_at?: string;
    checksum?: string;
  }>('POST', '/v1/reports/upload', {
    reportId,
    content: artifact.body,
    contentType: artifact.contentType,
    receiptRef,
    seriesRef: artifact.seriesRef,
  });

  if (!res.ok || !res.body?.location) {
    throw new Error(
      `chart report upload failed: HTTP ${res.status}${res.error ? ` — ${res.error}` : ''}`,
    );
  }

  return {
    location: res.body.location,
    reportId: res.body.reportId ?? reportId,
    receiptRef: res.body.receiptRef ?? receiptRef,
    seriesRef: artifact.seriesRef,
    written_at: res.body.written_at,
    checksum: res.body.checksum,
  };
}

/** In-memory mock for offline tests. */
export class MockReportUploadTransport implements ReportUploadTransport {
  readonly uploads: Array<{ path: string; body: unknown }> = [];

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; error?: string; body?: T }> {
    void method;
    this.uploads.push({ path, body });
    if (path !== '/v1/reports/upload') {
      return { ok: false, status: 404, error: 'no_route' };
    }
    const payload = body as { reportId: string; receiptRef?: string };
    return {
      ok: true,
      status: 200,
      body: {
        store: 'r2-via-worker',
        reportId: payload.reportId,
        location: `r2:uvrn-reports/reports/${payload.reportId}`,
        written_at: new Date().toISOString(),
        checksum: 'mock-checksum',
        receiptRef: payload.receiptRef,
      } as T,
    };
  }
}
