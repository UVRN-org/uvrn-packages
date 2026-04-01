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
});

describe('delta_verify_receipt', () => {
  it('should verify valid receipt', async () => {
    const { handleRunEngine, handleVerifyReceipt } = await import('../../tools/handlers');
    const receipt = (await handleRunEngine({ bundle: createTestBundle() })).receipt;
    const result = await handleVerifyReceipt({ receipt });

    expect(result.verified).toBe(true);
  });

  it('should detect tampered receipt', async () => {
    const { handleRunEngine, handleVerifyReceipt } = await import('../../tools/handlers');
    const receipt = (await handleRunEngine({ bundle: createTestBundle() })).receipt;
    const tampered = { ...receipt, outcome: 'indeterminate' as const };
    const result = await handleVerifyReceipt({ receipt: tampered });

    expect(result.verified).toBe(false);
    expect(result.details).toContain('Hash mismatch');
  });

  it('should handle malformed receipt', async () => {
    const { handleVerifyReceipt } = await import('../../tools/handlers');
    const result = await handleVerifyReceipt({ receipt: { bundleId: 'missing-hash' } as any });

    expect(result.verified).toBe(false);
    expect(result.error).toBe('Receipt missing hash');
  });
});

describe('delta_run_engine', () => {
  it('should execute valid bundle successfully', async () => {
    const { handleRunEngine } = await import('../../tools/handlers');
    const result = await handleRunEngine({ bundle: createTestBundle() });

    expect(result.success).toBe(true);
    expect(result.receipt.bundleId).toBe('test-bundle-001');
    expect(result.receipt.outcome).toBe('consensus');
    expect(result.receipt.hash).toBeDefined();
  });

  it('should reject invalid bundle (missing bundleId)', async () => {
    const { handleRunEngine } = await import('../../tools/handlers');
    const bundle = createTestBundle({ bundleId: '' });

    await expect(handleRunEngine({ bundle })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('should reject bundle with thresholdPct = 0', async () => {
    const { handleRunEngine } = await import('../../tools/handlers');
    const bundle = createTestBundle({ thresholdPct: 0 });

    await expect(handleRunEngine({ bundle })).rejects.toThrow(/thresholdPct must be > 0 and <= 1/);
  });

  it('should enforce MAX_BUNDLE_SIZE', async () => {
    process.env.MAX_BUNDLE_SIZE = '200';
    vi.resetModules();

    const { handleRunEngine } = await import('../../tools/handlers');
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

    const { handleRunEngine } = await import('../../tools/handlers');
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

    const { handleRunEngine } = await import('../../tools/handlers');
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
    const { handleValidateBundle } = await import('../../tools/handlers');
    const result = await handleValidateBundle({ bundle: createTestBundle() });

    expect(result.valid).toBe(true);
    expect(result.details).toContain('test-bundle-001');
  });

  it('should return valid:false for invalid bundle', async () => {
    const { handleValidateBundle } = await import('../../tools/handlers');
    const bundle = createTestBundle({ bundleId: '' });
    const result = await handleValidateBundle({ bundle });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing or invalid bundleId');
  });

  it('should validate thresholdPct constraints', async () => {
    const { handleValidateBundle } = await import('../../tools/handlers');

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
