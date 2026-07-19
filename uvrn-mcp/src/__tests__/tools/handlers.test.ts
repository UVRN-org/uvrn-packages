import type { ExecutionError } from '../../types';
import { createTestBundle } from '../fixtures/bundles';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

afterEach(() => {
  resetEnv();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unmock('@uvrn/core');
  vi.unmock('@uvrn/measure');
});

async function loadHandlers(runtimeConfig = {}) {
  const [{ buildHandlers }, { resolveRuntimeConfig }] = await Promise.all([
    import('../../tools/handlers'),
    import('../../config'),
  ]);
  return buildHandlers(resolveRuntimeConfig(runtimeConfig as any));
}

describe('delta_verify_receipt', () => {
  it('should verify valid receipt', async () => {
    const { handleRunEngine, handleVerifyReceipt } = await loadHandlers();
    const receipt = (await handleRunEngine({ bundle: createTestBundle() })).receipt;
    const result = await handleVerifyReceipt({ receipt });

    expect(result.verified).toBe(true);
  });

  it('should detect tampered receipt', async () => {
    const { handleRunEngine, handleVerifyReceipt } = await loadHandlers();
    const receipt = (await handleRunEngine({ bundle: createTestBundle() })).receipt;
    const tampered = { ...receipt, outcome: 'indeterminate' as const };
    const result = await handleVerifyReceipt({ receipt: tampered });

    expect(result.verified).toBe(false);
    expect(result.details).toContain('Hash mismatch');
  });

  it('should handle malformed receipt', async () => {
    const { handleVerifyReceipt } = await loadHandlers();
    const result = await handleVerifyReceipt({ receipt: { bundleId: 'missing-hash' } as any });

    expect(result.verified).toBe(false);
    expect(result.error).toBe('Receipt missing hash');
  });
});

describe('delta_run_engine', () => {
  it('should execute valid bundle successfully', async () => {
    const { handleRunEngine } = await loadHandlers();
    const result = await handleRunEngine({ bundle: createTestBundle() });

    expect(result.success).toBe(true);
    expect(result.receipt.bundleId).toBe('test-bundle-001');
    expect(result.receipt.outcome).toBe('consensus');
    expect(result.receipt.hash).toBeDefined();
  });

  it('should reject invalid bundle (missing bundleId)', async () => {
    const { handleRunEngine } = await loadHandlers();
    const bundle = createTestBundle({ bundleId: '' });

    await expect(handleRunEngine({ bundle })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('should reject bundle with thresholdPct = 0', async () => {
    const { handleRunEngine } = await loadHandlers();
    const bundle = createTestBundle({ thresholdPct: 0 });

    await expect(handleRunEngine({ bundle })).rejects.toThrow(/thresholdPct must be > 0 and <= 1/);
  });

  it('should enforce MAX_BUNDLE_SIZE', async () => {
    process.env.MAX_BUNDLE_SIZE = '200';
    vi.resetModules();

    const { handleRunEngine } = await loadHandlers();
    const bundle = createTestBundle({ claim: 'x'.repeat(1000) });

    try {
      await handleRunEngine({ bundle });
      throw new Error('Expected ValidationError');
    } catch (error) {
      const err = error as Error & { details?: unknown };
      expect(err.name).toBe('ValidationError');
      expect(err.details).toMatchObject({ maxBundleSize: 200 });
      expect((err.details as { bundleSize: number }).bundleSize).toBeGreaterThan(200);
    }
  });

  it('should include original error when VERBOSE_ERRORS=true', async () => {
    process.env.VERBOSE_ERRORS = 'true';
    vi.resetModules();

    vi.doMock('@uvrn/core', async () => {
      const actual = await vi.importActual<typeof import('@uvrn/core')>(
        '@uvrn/core'
      );
      return {
        ...actual,
        runDeltaEngine: () => {
          throw new Error('boom');
        },
      };
    });

    const { handleRunEngine } = await loadHandlers();
    const bundle = createTestBundle();

    try {
      await handleRunEngine({ bundle });
      throw new Error('Expected ExecutionError');
    } catch (error) {
      const err = error as Error & { details?: { originalError?: Error } };
      expect(err.name).toBe('ExecutionError');
      expect(err.details).toHaveProperty('originalError');
      expect(err.details!.originalError!.message).toBe('boom');
    }
  });

  it('should omit original error when VERBOSE_ERRORS=false', async () => {
    process.env.VERBOSE_ERRORS = 'false';
    vi.resetModules();

    vi.doMock('@uvrn/core', async () => {
      const actual = await vi.importActual<typeof import('@uvrn/core')>(
        '@uvrn/core'
      );
      return {
        ...actual,
        runDeltaEngine: () => {
          throw new Error('boom');
        },
      };
    });

    const { handleRunEngine } = await loadHandlers();
    const bundle = createTestBundle();

    try {
      await handleRunEngine({ bundle });
      throw new Error('Expected ExecutionError');
    } catch (error) {
      const err = error as Error & { details?: unknown };
      expect(err.name).toBe('ExecutionError');
      expect(err.details).toBeUndefined();
    }
  });
});

describe('delta_validate_bundle', () => {
  it('should return valid:true for valid bundle', async () => {
    const { handleValidateBundle } = await loadHandlers();
    const result = await handleValidateBundle({ bundle: createTestBundle() });

    expect(result.valid).toBe(true);
    expect(result.details).toContain('test-bundle-001');
  });

  it('should return valid:false for invalid bundle', async () => {
    const { handleValidateBundle } = await loadHandlers();
    const bundle = createTestBundle({ bundleId: '' });
    const result = await handleValidateBundle({ bundle });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing or invalid bundleId');
  });

  it('should validate thresholdPct constraints', async () => {
    const { handleValidateBundle } = await loadHandlers();

    const zeroThreshold = await handleValidateBundle({
      bundle: createTestBundle({ thresholdPct: 0 }),
    });
    expect(zeroThreshold.valid).toBe(false);
    expect(zeroThreshold.error).toBe('thresholdPct must be > 0 and <= 1');

    const overThreshold = await handleValidateBundle({
      bundle: createTestBundle({ thresholdPct: 1.1 }),
    });
    expect(overThreshold.valid).toBe(false);
    expect(overThreshold.error).toBe('thresholdPct must be > 0 and <= 1');
  });
});

describe('delta_score_drift', () => {
  it('should compute drift for an enriched DriftInputReceipt', async () => {
    const { handleScoreDrift } = await loadHandlers();
    const result = await handleScoreDrift({
      receipt: {
        receipt_id: 'receipt-001',
        issuer: 'issuer-a',
        timestamp: '2026-06-01T00:00:00.000Z',
        v_score: 85,
        components: {
          completeness: 90,
          parity: 80,
          freshness: 70,
        },
      },
      asOf: '2026-06-02T00:00:00.000Z',
      profile: 'default',
    });

    expect(result.receipt.drift).toBeDefined();
    expect(result.receipt.receipt_id).toBe('receipt-001');
  });

  it('should reject raw DeltaReceipt-shaped input', async () => {
    const { handleScoreDrift } = await loadHandlers();

    await expect(
      handleScoreDrift({
        receipt: {
          bundleId: 'raw-delta',
          deltaFinal: 0,
          sources: [],
          rounds: [],
          suggestedFixes: [],
          outcome: 'consensus',
          hash: 'abc',
        } as any,
      })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('should reject invalid asOf values', async () => {
    const { handleScoreDrift } = await loadHandlers();

    await expect(
      handleScoreDrift({
        receipt: {
          receipt_id: 'receipt-001',
          issuer: 'issuer-a',
          timestamp: '2026-06-01T00:00:00.000Z',
          v_score: 85,
          components: {
            completeness: 90,
            parity: 80,
            freshness: 70,
          },
        },
        asOf: 'not-a-date',
      })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

describe('delta_compare', () => {
  it('should compare two already scored receipts', async () => {
    const { handleCompare } = await loadHandlers();
    const result = await handleCompare({
      receipts: [
        { claimId: 'claim-a', vScore: 82, status: 'STABLE', scoredAt: '2026-06-01T00:00:00.000Z' },
        { claimId: 'claim-b', vScore: 74, status: 'DRIFTING', scoredAt: '2026-06-01T00:00:00.000Z' },
      ],
    });

    expect(result.result.delta).toBe(8);
    expect(result.result.summary).toContain('claim-a');
  });

  it('should reject anything other than exactly two receipts', async () => {
    const { handleCompare } = await loadHandlers();

    await expect(
      handleCompare({
        receipts: [{ claimId: 'claim-a', vScore: 82 }],
      })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('should reject raw DeltaReceipt-shaped input', async () => {
    const { handleCompare } = await loadHandlers();

    await expect(
      handleCompare({
        receipts: [
          { bundleId: 'raw-a', deltaFinal: 0, hash: 'a' } as any,
          { claimId: 'claim-b', vScore: 74 },
        ],
      })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

describe('delta_verify_identity', () => {
  it('should return null for unknown in-memory identity reputation', async () => {
    const { handleVerifyIdentity } = await loadHandlers();
    const result = await handleVerifyIdentity({ address: '0xabc' });

    expect(result.reputation).toBeNull();
  });

  it('should reject missing addresses', async () => {
    const { handleVerifyIdentity } = await loadHandlers();

    await expect(handleVerifyIdentity({ address: '' })).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

describe('delta_canon_qualify', () => {
  it('should assess qualification without writing to a store', async () => {
    const { handleCanonQualify } = await loadHandlers();
    const result = await handleCanonQualify({
      claimId: 'claim-a',
      snapshot: {
        receiptId: 'receipt-a',
        claimId: 'claim-a',
        scoredAt: '2026-06-05T00:00:00.000Z',
        components: { completeness: 90, parity: 90, freshness: 90 },
        vScore: 90,
        status: 'STABLE',
      },
    });

    expect(typeof result.result.qualifies).toBe('boolean');
    expect(result.result.reason).toBeDefined();
  });

  it('should reject missing claimId', async () => {
    const { handleCanonQualify } = await loadHandlers();

    await expect(handleCanonQualify({ claimId: '', snapshot: {} as any })).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });
});

describe('delta_canon_get', () => {
  it('should read a known canon receipt from the configured store', async () => {
    const receipt = { canon_id: 'canon-1' };
    const store = {
      type: 'r2',
      write: vi.fn(),
      read: vi.fn(async (canonId: string) => (canonId === 'canon-1' ? receipt : null)),
      exists: vi.fn(),
    };
    const { handleCanonGet } = await loadHandlers({ canonStores: [store] });

    await expect(handleCanonGet({ canonId: 'canon-1' })).resolves.toEqual({ receipt });
    await expect(handleCanonGet({ canonId: 'missing' })).resolves.toEqual({ receipt: null });
    expect(store.read).toHaveBeenCalledWith('canon-1');
  });
});

describe('delta_score_claim', () => {
  it('should produce a verifiable MasterReceipt with the zero-external default connector', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'Mock claim has value 100' });

    expect(result.masterReceipt.masterHash).toBeDefined();
    expect(result.masterReceipt.base.hash).toBeDefined();
    expect(result.masterReceipt.nodes).toEqual([
      expect.objectContaining({ status: 'on' }),
    ]);
    // v4: thin history is reported as insufficient-data, never 'none'
    // (SPEC/uvrn-measurement-v1.md §3.4/§4 — the mock path supplies no agreement history).
    expect(result.masterReceipt.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'potential',
          verdict: 'insufficient-data',
        }),
      ])
    );
    expect(typeof result.v_score).toBe('number');
    expect(Number.isFinite(result.v_score)).toBe(true);
    expect(typeof result.claimId).toBe('string');
    expect(result.claimId.length).toBeGreaterThan(0);
    expect(result.evidenceMode).toBe('mock');
    expect(typeof result.sourceCount).toBe('number');
    expect(result.sourceCount).toBeGreaterThanOrEqual(2);
  });

  it('should use host-provided sources and return evidenceMode host_sources', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Cottagecore prints are trending',
      claimId: 'test-cottagecore',
      sources: [
        { url: 'https://example.com/a', title: 'Source A', snippet: 'Growing rapidly', evidenceScore: 80 },
        { url: 'https://example.com/b', title: 'Source B', snippet: 'Strong demand', evidenceScore: 75 },
      ],
    });

    expect(result.evidenceMode).toBe('host_sources');
    expect(result.claimId).toBe('test-cottagecore');
    expect(result.sourceCount).toBe(2);
    expect(Number.isFinite(result.v_score)).toBe(true);
    expect(result.masterReceipt.masterHash).toBeDefined();
  });

  it('runs the stance axis and carries stance provenance inside the receipt payload', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const sources = [
      { url: 'https://example.com/a', title: 'A', snippet: 'Evidence A', evidenceScore: 80, stanceValue: 0.9, stanceLabel: 'supports' as const, stanceConfidence: 0.9, stanceEvidence: 'A supports the claim.' },
      { url: 'https://example.com/b', title: 'B', snippet: 'Evidence B', evidenceScore: 70, stanceValue: -0.8, stanceLabel: 'opposes' as const, stanceConfidence: 0.9, stanceEvidence: 'B opposes the claim.' },
      { url: 'https://example.com/c', title: 'C', snippet: 'Evidence C', evidenceScore: 60, stanceValue: 0.7, stanceLabel: 'supports' as const, stanceConfidence: 0.8, stanceEvidence: 'C supports the claim.' },
      { url: 'https://example.com/d', title: 'D', snippet: 'Evidence D', evidenceScore: 50, stanceValue: 0.6, stanceLabel: 'supports' as const, stanceConfidence: 0.8, stanceEvidence: 'D supports the claim.' },
    ];

    const result = await handleScoreClaim({
      claim: 'Explicit stance claim',
      sources,
    });
    const payload = result.networkReceipt.payload as {
      stanceMode?: { evidenceAxis?: string; quorumMet?: boolean };
      stanceSummary?: { support: number; oppose: number };
    };

    expect(payload.stanceMode).toMatchObject({
      evidenceAxis: 'stance',
      quorumMet: true,
    });
    expect(payload.stanceSummary).toEqual({ support: 3, oppose: 1 });
    expect(result.humanView.headline).toContain('3 support / 1 oppose');
    expect(result.humanView.stanceSummary).toEqual({ support: 3, oppose: 1 });
  });

  it('attaches stanceMode on prominence fallback without mutating masterReceipt', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    // Below source quorum (2 < 4) → prominence fallback with host provenance (SPEC §3).
    const result = await handleScoreClaim({
      claim: 'Prominence fallback still records stanceMode',
      sources: [
        {
          url: 'https://example.com/a',
          title: 'A',
          snippet: 'Evidence A',
          evidenceScore: 80,
          stanceValue: 0.9,
          stanceLabel: 'supports' as const,
          stanceConfidence: 0.9,
          stanceEvidence: 'A supports the claim.',
        },
        {
          url: 'https://example.com/b',
          title: 'B',
          snippet: 'Evidence B',
          evidenceScore: 70,
          stanceValue: -0.8,
          stanceLabel: 'opposes' as const,
          stanceConfidence: 0.9,
          stanceEvidence: 'B opposes the claim.',
        },
      ],
    });
    const payload = result.networkReceipt.payload as {
      stanceMode?: {
        evidenceAxis?: string;
        quorumMet?: boolean;
        fallbackReason?: string;
        sourceCount?: number;
        groundedCount?: number;
      };
      stanceSummary?: { support: number; oppose: number };
    };

    expect(payload.stanceMode).toMatchObject({
      evidenceAxis: 'prominence',
      quorumMet: false,
      fallbackReason: 'source-quorum-missed',
      sourceCount: 2,
      groundedCount: 2,
    });
    expect(payload.stanceSummary).toBeUndefined();
    expect(
      (result.masterReceipt as { stanceMode?: unknown }).stanceMode
    ).toBeUndefined();
  });

  it('should score host sources by evidenceScore even when titles contain numbers', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();

    // Numeric titles ("Top 10" / "Top 99") that disagree with the evidenceScores (80 / 60).
    const numericTitles = await handleScoreClaim({
      claim: 'Numeric titles must not override evidenceScore',
      claimId: 'test-numeric-titles',
      sources: [
        { url: 'https://example.com/a', title: 'Top 10 trend report', snippet: 'Strong demand', evidenceScore: 80, publishedAt: '2026-06-01T00:00:00.000Z', credibility: 0.9 },
        { url: 'https://example.com/b', title: 'Top 99 movers', snippet: 'Cooling off', evidenceScore: 60, publishedAt: '2026-06-04T00:00:00.000Z', credibility: 0.9 },
      ],
    });

    // Same evidenceScores/dates/credibility, but title text carries NO numbers.
    const cleanTitles = await handleScoreClaim({
      claim: 'Numeric titles must not override evidenceScore',
      claimId: 'test-clean-titles',
      sources: [
        { url: 'https://example.com/a', title: 'Trend report', snippet: 'Strong demand', evidenceScore: 80, publishedAt: '2026-06-01T00:00:00.000Z', credibility: 0.9 },
        { url: 'https://example.com/b', title: 'Market movers', snippet: 'Cooling off', evidenceScore: 60, publishedAt: '2026-06-04T00:00:00.000Z', credibility: 0.9 },
      ],
    });

    expect(numericTitles.evidenceMode).toBe('host_sources');
    expect(numericTitles.sourceCount).toBe(2);
    expect(Number.isFinite(numericTitles.v_score)).toBe(true);
    // Title invariance: the number in the title must not affect the score at all.
    expect(numericTitles.v_score).toBe(cleanTitles.v_score);
  });

  it('sourceCount reflects sources dropped as non-numeric (3 raw → 2 scored)', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Source count excludes non-numeric sources',
      sources: [
        { url: 'https://example.com/a', title: 'Source A', snippet: 'Strong demand', evidenceScore: 80 },
        { url: 'https://example.com/b', title: 'Source B', snippet: 'Weak demand', evidenceScore: 60 },
        { url: 'https://example.com/c', title: 'Qualitative note', snippet: 'No numeric evidence present.' },
      ],
    });

    expect(result.evidenceMode).toBe('host_sources');
    expect(result.sourceCount).toBe(2);
  });

  it('sourceCount reflects near-identical sources deduped (3 raw → 2 scored)', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Source count collapses near-identical sources',
      sources: [
        { url: 'https://example.com/a', title: 'Source A', snippet: 'demand', evidenceScore: 80, publishedAt: '2026-06-05T00:00:00.000Z' },
        { url: 'https://example.com/b', title: 'Source B', snippet: 'demand', evidenceScore: 80.5, publishedAt: '2026-06-05T00:00:00.000Z' },
        { url: 'https://example.com/c', title: 'Source C', snippet: 'demand', evidenceScore: 60, publishedAt: '2026-06-05T00:00:00.000Z' },
      ],
    });

    expect(result.evidenceMode).toBe('host_sources');
    expect(result.sourceCount).toBe(2);
  });

  it('rejects exactly one host source with a ValidationError', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();

    await expect(
      handleScoreClaim({
        claim: 'Single host source is not enough',
        sources: [{ url: 'https://example.com/a', title: 'Source A', snippet: 'demand', evidenceScore: 80 }],
      })
    ).rejects.toThrow('Host evidence requires at least 2 sources');
  });

  it('host sources take precedence over configured connectors', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const connector = {
      async fetch() {
        throw new Error('connector should not be called when host sources are supplied');
      },
    };
    const { handleScoreClaim } = await loadHandlers({ connectors: [connector] });
    const result = await handleScoreClaim({
      claim: 'Host wins over connectors',
      sources: [
        { url: 'https://example.com/a', title: 'Source A', snippet: 'demand', evidenceScore: 80 },
        { url: 'https://example.com/b', title: 'Source B', snippet: 'demand', evidenceScore: 60 },
      ],
    });

    expect(result.evidenceMode).toBe('host_sources');
  });

  it('rejects out-of-range or non-finite evidenceScore and credibility', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();

    const base = { url: 'https://example.com/b', title: 'Source B', snippet: 'demand', evidenceScore: 60 };

    await expect(
      handleScoreClaim({
        claim: 'evidenceScore above range',
        sources: [{ url: 'https://example.com/a', title: 'A', snippet: 'demand', evidenceScore: 150 }, base],
      })
    ).rejects.toThrow('evidenceScore must be a finite number between 0 and 100');

    await expect(
      handleScoreClaim({
        claim: 'evidenceScore not finite',
        sources: [{ url: 'https://example.com/a', title: 'A', snippet: 'demand', evidenceScore: Infinity }, base],
      })
    ).rejects.toThrow('evidenceScore must be a finite number between 0 and 100');

    await expect(
      handleScoreClaim({
        claim: 'credibility above range',
        sources: [{ url: 'https://example.com/a', title: 'A', snippet: 'demand', evidenceScore: 80, credibility: 2 }, base],
      })
    ).rejects.toThrow('credibility must be a finite number between 0 and 1');

    await expect(
      handleScoreClaim({
        claim: 'stance out of range',
        sources: [
          { url: 'https://example.com/a', title: 'A', snippet: 'demand', evidenceScore: 80, stanceValue: 2 },
          base,
        ],
      })
    ).rejects.toThrow('stanceValue must be a finite number between -1 and 1');

    await expect(
      handleScoreClaim({
        claim: 'stance label invalid',
        sources: [
          { ...base, url: 'https://example.com/a', stanceLabel: 'maybe' as never },
          base,
        ],
      })
    ).rejects.toThrow('stanceLabel must be one of');
  });

  it('derives a collision-resistant claimId from claim text when none is supplied', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Cottagecore prints are trending',
      sources: [
        { url: 'https://example.com/a', title: 'Source A', snippet: 'demand', evidenceScore: 80 },
        { url: 'https://example.com/b', title: 'Source B', snippet: 'demand', evidenceScore: 60 },
      ],
    });

    // human-readable slug + 8-char deterministic hash suffix
    expect(result.claimId).toMatch(/^cottagecore-prints-are-trending-[0-9a-f]{8}$/);
  });

  it('should preserve a failed connector as node status while scoring remaining sources', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const goodConnector = {
      async fetch() {
        return {
          claimId: 'claim-a',
          fetchedAt: '2026-06-05T00:00:00.000Z',
          durationMs: 1,
          sources: [
            {
              url: 'mock://a',
              title: 'A',
              snippet: 'value 100',
              publishedAt: '2026-06-05T00:00:00.000Z',
              credibility: 0.9,
            },
            {
              url: 'mock://b',
              title: 'B',
              snippet: 'value 102',
              publishedAt: '2026-06-05T00:00:00.000Z',
              credibility: 0.9,
            },
          ],
        };
      },
    };
    const badConnector = {
      async fetch() {
        throw new Error('simulated outage');
      },
    };
    const { handleScoreClaim } = await loadHandlers({ connectors: [badConnector, goodConnector] });
    const result = await handleScoreClaim({ claim: 'Claim with partial connector failure', claimId: 'claim-a' });

    expect(result.masterReceipt.nodes).toEqual([
      expect.objectContaining({ status: 'off', detail: 'simulated outage' }),
      expect.objectContaining({ status: 'on' }),
    ]);
  });

  it('should pass valid ISO measurement timestamps when connector source timestamps are invalid or missing', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();

    let capturedSources: Array<{ ts?: string }> = [];
    vi.doMock('@uvrn/measure', async () => {
      const actual = await vi.importActual<typeof import('@uvrn/measure')>('@uvrn/measure');
      return {
        ...actual,
        defaultRegistry: () => {
          const registry = actual.defaultRegistry();
          return {
            runAll(input: Parameters<typeof registry.runAll>[0]) {
              capturedSources = input.sources.map((source) => ({ ts: source.ts }));
              return registry.runAll(input);
            },
          };
        },
      };
    });

    const connector = {
      async fetch() {
        return {
          claimId: 'claim-invalid-ts',
          fetchedAt: '2026-06-05T00:00:00.000Z',
          durationMs: 1,
          sources: [
            {
              url: 'mock://invalid-timestamp',
              title: 'Invalid Timestamp Source',
              snippet: 'value 100',
              publishedAt: 'not-a-date',
              credibility: 0.9,
            },
            {
              url: 'mock://missing-timestamp',
              title: 'Missing Timestamp Source',
              snippet: 'value 102',
              credibility: 0.9,
            },
          ],
        };
      },
    };

    const { handleScoreClaim } = await loadHandlers({ connectors: [connector] });
    const result = await handleScoreClaim({ claim: 'Claim with malformed timestamps', claimId: 'claim-invalid-ts' });

    expect(result.masterReceipt.masterHash).toBeDefined();
    expect(capturedSources.length).toBeGreaterThanOrEqual(2);
    for (const source of capturedSources) {
      expect(source.ts).toBeDefined();
      expect(new Date(source.ts!).toISOString()).toBe(source.ts);
    }
  });

  it('returns a verified NetworkReceipt + HumanView with a normalized topic on the zero-external mock path (v4 e2e)', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Mock claim has value 100',
      topic: 'Markets/Crypto',
    });

    // Signed uvrn-receipt-4 envelope, verifiable with the run's ephemeral public key.
    expect(result.networkReceipt.schemaVersion).toBe('uvrn-receipt-4');
    expect(result.networkReceipt.kind).toBe('master');
    expect(result.networkReceipt.signature?.publicKeyRef).toBe('uvrn-mcp-ephemeral');
    expect(typeof result.signerPublicKey).toBe('string');

    const { verifyReceiptFull } = await import('@uvrn/receipt');
    const verification = verifyReceiptFull(result.networkReceipt, {
      publicKey: result.signerPublicKey,
    });
    expect(verification.verified).toBe(true);

    // Human view is render-ready.
    expect(typeof result.humanView.verdictLabel).toBe('string');
    expect(result.humanView.verdictLabel.length).toBeGreaterThan(0);
    expect(result.humanView.measurements.length).toBeGreaterThan(0);
    expect(result.humanView.scoreCard.vScore).toBe(result.v_score);

    // Topic is normalized onto the envelope.
    expect(result.networkReceipt.topic).toBe('markets/crypto');

    // Existing fields are unchanged (additive contract).
    expect(result.masterReceipt.masterHash).toBeDefined();
    expect(typeof result.v_score).toBe('number');
    expect(result.evidenceMode).toBe('mock');
  });

  it('enriches measurements with humanExplanation INSIDE the hashed master envelope', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({ claim: 'Mock claim has value 100' });

    for (const measurement of result.masterReceipt.measurements) {
      expect(typeof (measurement as { humanExplanation?: string }).humanExplanation).toBe('string');
    }
    // The master hash must still verify — proof enrichment happened before hashing.
    const { verifyMasterReceipt } = await import('@uvrn/core');
    expect(verifyMasterReceipt(result.masterReceipt).verified).toBe(true);
  });

  it('omits topic from the NetworkReceipt when not supplied and rejects empty topic', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();

    const result = await handleScoreClaim({ claim: 'Mock claim has value 100' });
    expect(result.networkReceipt.topic).toBeUndefined();

    await expect(
      handleScoreClaim({ claim: 'Mock claim has value 100', topic: '' })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('uses injected explicit signing keys and never emits signerPublicKey (RuntimeConfig injection)', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { generateReceiptKeyPair, verifyReceiptFull } = await import('@uvrn/receipt');
    const keyPair = generateReceiptKeyPair();
    const { handleScoreClaim } = await loadHandlers({
      signing: { privateKey: keyPair.privateKey, publicKeyRef: 'test-producer-v1' },
    });
    const result = await handleScoreClaim({ claim: 'Mock claim has value 100' });

    expect(result.signerPublicKey).toBeUndefined();
    expect(result.networkReceipt.signature?.publicKeyRef).toBe('test-producer-v1');
    // No private key material anywhere in the serialized result.
    expect(JSON.stringify(result)).not.toContain(keyPair.privateKey);
    expect(
      verifyReceiptFull(result.networkReceipt, { keys: { 'test-producer-v1': keyPair.publicKey } })
        .verified
    ).toBe(true);
  });

  it('generates one ephemeral keypair per handler construction, reused across calls', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();
    const { handleScoreClaim } = await loadHandlers();
    const first = await handleScoreClaim({ claim: 'Mock claim has value 100' });
    const second = await handleScoreClaim({ claim: 'Mock claim has value 102' });
    expect(first.signerPublicKey).toBe(second.signerPublicKey);

    const { handleScoreClaim: other } = await loadHandlers();
    const fresh = await other({ claim: 'Mock claim has value 100' });
    expect(fresh.signerPublicKey).not.toBe(first.signerPublicKey);
  });

  it('should wrap unexpected score-claim failures in ExecutionError', async () => {
    process.env.VERBOSE_ERRORS = 'true';
    vi.resetModules();

    vi.doMock('@uvrn/core', async () => {
      const actual = await vi.importActual<typeof import('@uvrn/core')>('@uvrn/core');
      return {
        ...actual,
        runDeltaEngine: () => {
          throw new Error('score-claim boom');
        },
      };
    });

    const { handleScoreClaim } = await loadHandlers();

    try {
      await handleScoreClaim({ claim: 'Mock claim has value 100' });
      throw new Error('Expected ExecutionError');
    } catch (error) {
      const err = error as ExecutionError & { details?: { originalError?: Error } };
      expect(err.name).toBe('ExecutionError');
      expect(err.message).toContain('Score claim failed: score-claim boom');
      expect(err.details).toHaveProperty('originalError');
      expect(err.details!.originalError!.message).toBe('score-claim boom');
    }
  });
});
