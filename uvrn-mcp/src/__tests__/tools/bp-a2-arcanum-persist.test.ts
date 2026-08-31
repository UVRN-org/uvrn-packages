/**
 * BP-A2 FIRST CONSUMER — delta_score_claim persists through injected arcanum archive.
 * Durable signing (arcanum-producer-v1) + reopen store ("restart") + verifyReceiptFull.
 */

import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

async function loadArcanumProducerKeys(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const umbrellaSecrets = resolve(process.cwd(), '../../../../secrets/arcanum');
  const alt = resolve(process.cwd(), '../../../secrets/arcanum');
  for (const dir of [umbrellaSecrets, alt]) {
    const privPath = resolve(dir, 'arcanum-producer-v1.private.b64');
    const pubPath = resolve(dir, 'arcanum-producer-v1.public.b64');
    if (existsSync(privPath) && existsSync(pubPath)) {
      return {
        privateKey: readFileSync(privPath, 'utf8').trim(),
        publicKey: readFileSync(pubPath, 'utf8').trim(),
      };
    }
  }
  const { generateReceiptKeyPair } = await import('@uvrn/receipt');
  const kp = generateReceiptKeyPair();
  return { privateKey: kp.privateKey, publicKey: kp.publicKey };
}

describe('BP-A2 arcanum persist (first consumer)', () => {
  let dir: string;
  let dbPath: string;
  let arcanumAvailable = false;

  beforeAll(async () => {
    try {
      await import('@suttlemedia/arcanum');
      arcanumAvailable = true;
    } catch {
      arcanumAvailable = false;
    }
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uvrn-mcp-a2-'));
    dbPath = join(dir, 'master.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('delta_score_claim + durable signing + arcanum survives restart and verifies', async () => {
    if (!arcanumAvailable) {
      console.warn('Skipping: @suttlemedia/arcanum optional peer not installed');
      return;
    }
    vi.doUnmock('@uvrn/core');
    vi.resetModules();

    const { verifyReceiptFull } = await import('@uvrn/receipt');
    const { openArcanum } = await import('@suttlemedia/arcanum');

    const keys = await loadArcanumProducerKeys();
    const archive = openArcanum({ dbPath, driver: 'node:sqlite' });

    const { handleScoreClaim } = await loadHandlers({
      signing: {
        privateKey: keys.privateKey,
        publicKeyRef: 'arcanum-producer-v1',
      },
      arcanum: archive,
    });

    const result = await handleScoreClaim({
      claim: 'BP-A2 first consumer: scored claim must survive exit',
      topic: 'markets/creator-tools/bp-a2-persist',
    });

    const receipt = result.networkReceipt;
    expect(receipt.arcanumType).toBe('uvrn-market');
    expect(receipt.signature?.publicKeyRef).toBe('arcanum-producer-v1');
    expect(result.signerPublicKey).toBeUndefined();

    const hash = receipt.receiptHash;
    expect(archive.get(hash)?.receiptHash).toBe(hash);
    archive.close();

    // "Restart" — reopen master DB, load, verify
    const reopened = openArcanum({ dbPath, driver: 'node:sqlite' });
    const loaded = reopened.get(hash);
    expect(loaded).not.toBeNull();
    expect(loaded!.arcanumType).toBe('uvrn-market');
    expect(loaded!.kind).not.toBe('uvrn-market'); // purpose is not kind
    expect(loaded!.tags).toBeUndefined();

    const verify = verifyReceiptFull(loaded!, { publicKey: keys.publicKey });
    expect(verify.verified).toBe(true);
    expect(verify.integrityOk).toBe(true);
    expect(verify.signatureOk).toBe(true);
    reopened.close();
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
