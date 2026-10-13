/**
 * BP-A2 FIRST CONSUMER — delta_score_claim persists through an injected archive
 * (`RuntimeConfig.arcanum`): durable signing, a stored round trip ("restart"), verifyReceiptFull.
 */

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

async function loadHandlers(runtimeConfig = {}) {
  const [{ buildHandlers }, { resolveRuntimeConfig }] = await Promise.all([
    import('../../tools/handlers'),
    import('../../config'),
  ]);
  return buildHandlers(resolveRuntimeConfig(runtimeConfig as any));
}

/**
 * In-memory stand-in for an injected archive. It implements the public `RuntimeConfig.arcanum`
 * contract (`persist`) and stores receipts as JSON, so reading one back is a real
 * serialize/deserialize round trip, the same thing a durable store does across a restart.
 */
function memoryArchive() {
  const rows = new Map<string, string>();
  return {
    persist(receipt: any) {
      rows.set(receipt.receiptHash, JSON.stringify(receipt));
      return receipt;
    },
    get(hash: string) {
      const row = rows.get(hash);
      return row === undefined ? null : JSON.parse(row);
    },
    size: () => rows.size,
  };
}

describe('BP-A2 archive persist (first consumer)', () => {
  it('delta_score_claim persists the signed receipt to an injected archive, and it verifies after a round trip', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();

    const { verifyReceiptFull, generateReceiptKeyPair } = await import('@uvrn/receipt');
    const keys = generateReceiptKeyPair();
    const archive = memoryArchive();

    const { handleScoreClaim } = await loadHandlers({
      signing: { privateKey: keys.privateKey, publicKeyRef: 'test-producer-v1' },
      arcanum: archive,
    });

    const result = await handleScoreClaim({
      claim: 'BP-A2 first consumer: scored claim must survive exit',
      topic: 'markets/creator-tools/bp-a2-persist',
    });

    const receipt = result.networkReceipt;
    expect(receipt.arcanumType).toBe('uvrn-market');
    expect(receipt.signature?.publicKeyRef).toBe('test-producer-v1');
    expect(result.signerPublicKey).toBeUndefined(); // explicit keys are never echoed
    expect(archive.size()).toBe(1);

    // "Restart": read the stored JSON back and verify integrity + signature.
    const loaded = archive.get(receipt.receiptHash);
    expect(loaded).not.toBeNull();
    expect(loaded.receiptHash).toBe(receipt.receiptHash);
    expect(loaded.arcanumType).toBe('uvrn-market');
    expect(loaded.kind).not.toBe('uvrn-market'); // purpose is not kind
    expect(loaded.tags).toBeUndefined();

    const verify = verifyReceiptFull(loaded, { publicKey: keys.publicKey });
    expect(verify.integrityOk).toBe(true);
    expect(verify.signatureOk).toBe(true);
    expect(verify.verified).toBe(true);
  });

  it('omitting arcanum keeps ephemeral default (no persist required)', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();

    const { handleScoreClaim } = await loadHandlers();
    const result = await handleScoreClaim({
      claim: 'Ephemeral host without arcanum still scores',
    });
    expect(result.networkReceipt.signature?.publicKeyRef).toBe('uvrn-mcp-ephemeral');
    expect(result.signerPublicKey).toBeDefined();
    expect(result.networkReceipt.arcanumType).toBe('uvrn-research');
  });
});
