/**
 * W0-EXIT-DEMO — Wave 0 → Wave 1 gate as MCP vitest.
 * Checklist mirrors `.admin/builds/uvrn-arcanum/04-agent-ops/W0-EXIT-DEMO.md`.
 * Keys are injected at runtime from umbrella secrets (or generated fixtures) —
 * never committed; never echoed as private material in assertions/evidence.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

/** Prefer Admin/agent umbrella secrets; fall back to an in-memory keypair for CI. */
async function loadArcanumProducerKeys(): Promise<{
  privateKey: string;
  publicKey: string;
  source: 'umbrella-secrets' | 'ephemeral-fixture';
}> {
  const secretsDir = resolve(
    process.cwd(),
    '../../../secrets/arcanum'
  );
  // worktree cwd is uvrn-mcp → ../../../ = worktrees/v2.1; climb to umbrella
  const umbrellaSecrets = resolve(
    process.cwd(),
    '../../../../secrets/arcanum'
  );
  const candidates = [umbrellaSecrets, secretsDir];
  for (const dir of candidates) {
    const privPath = resolve(dir, 'arcanum-producer-v1.private.b64');
    const pubPath = resolve(dir, 'arcanum-producer-v1.public.b64');
    if (existsSync(privPath) && existsSync(pubPath)) {
      return {
        privateKey: readFileSync(privPath, 'utf8').trim(),
        publicKey: readFileSync(pubPath, 'utf8').trim(),
        source: 'umbrella-secrets',
      };
    }
  }
  const { generateReceiptKeyPair } = await import('@uvrn/receipt');
  const kp = generateReceiptKeyPair();
  return { privateKey: kp.privateKey, publicKey: kp.publicKey, source: 'ephemeral-fixture' };
}

describe('W0-EXIT-DEMO (BP-A1 identity floor)', () => {
  it('PASSes the Wave 0 signal checklist for two durable score runs', async () => {
    vi.doUnmock('@uvrn/core');
    vi.resetModules();

    const {
      computeNetworkReceiptHash,
      verifyReceiptFull,
      canonicalClaimId,
    } = await import('@uvrn/receipt');

    const keys = await loadArcanumProducerKeys();
    const { handleScoreClaim } = await loadHandlers({
      signing: {
        privateKey: keys.privateKey,
        publicKeyRef: 'arcanum-producer-v1',
      },
    });

    const claim = 'W0 exit demo: durable arcanum producer identity holds';
    const topic = 'markets/creator-tools/w0-exit';

    // Step 1 — score the same claim twice (two independent invocations)
    const a = await handleScoreClaim({ claim, topic });
    const b = await handleScoreClaim({ claim, topic });
    const receiptA = a.networkReceipt;
    const receiptB = b.networkReceipt;

    // Step 2 — shared canonicalClaimId
    const expectedClaimId = canonicalClaimId(claim, 'markets');
    expect(receiptA.canonicalClaimId).toBe(expectedClaimId);
    expect(receiptB.canonicalClaimId).toBe(expectedClaimId);

    // Step 3 — verifyReceiptFull as arcanum-producer-v1
    const verifyA = verifyReceiptFull(receiptA, {
      keys: { 'arcanum-producer-v1': keys.publicKey },
    });
    const verifyB = verifyReceiptFull(receiptB, {
      keys: { 'arcanum-producer-v1': keys.publicKey },
    });
    expect(verifyA.verified).toBe(true);
    expect(verifyB.verified).toBe(true);
    expect(receiptA.signature?.publicKeyRef).toBe('arcanum-producer-v1');
    expect(receiptB.signature?.publicKeyRef).toBe('arcanum-producer-v1');

    // Step 4 — arcanumType present (markets → uvrn-market)
    expect(receiptA.arcanumType).toBe('uvrn-market');
    expect(receiptB.arcanumType).toBe('uvrn-market');

    // Step 5 — signal checklist (§4) for both receipts
    for (const [label, receipt, verify] of [
      ['A', receiptA, verifyA],
      ['B', receiptB, verifyB],
    ] as const) {
      expect(receipt.schemaVersion, `${label} schemaVersion`).toBe('uvrn-receipt-4');
      expect(computeNetworkReceiptHash(receipt), `${label} integrity`).toBe(receipt.receiptHash);
      expect(receipt.signature, `${label} signature present`).toBeDefined();
      expect(receipt.signature!.publicKeyRef, `${label} publicKeyRef`).toBe('arcanum-producer-v1');
      expect(verify.integrityOk, `${label} integrityOk`).toBe(true);
      expect(verify.signatureOk, `${label} signatureOk`).toBe(true);
      expect(verify.verified, `${label} verifyReceiptFull`).toBe(true);
      expect(receipt.canonicalClaimId, `${label} claimId`).toBe(expectedClaimId);
      expect(receipt.arcanumType, `${label} arcanumType`).toMatch(/^uvrn-(market|research)$/);
      expect(receipt.kind, `${label} kind is protocol type`).toBe('master');
      expect(receipt.tags, `${label} tags not purpose axis`).toBeUndefined();
    }

    // Honest vocabulary: integrity-checked ≠ verified — verifyReceiptFull covers both.
    expect(verifyA.integrityOk).toBe(true);
    expect(verifyA.signatureOk).toBe(true);

    // No private key material in tool results
    expect(JSON.stringify(a)).not.toContain(keys.privateKey);
    expect(JSON.stringify(b)).not.toContain(keys.privateKey);
    expect(a.signerPublicKey).toBeUndefined();
    expect(b.signerPublicKey).toBeUndefined();

    // W0 arcanumType collapse note: non-markets / missing topic → uvrn-research
    const researchRun = await handleScoreClaim({
      claim: 'W0 collapse note: research path',
      topic: 'research/w0-collapse',
    });
    const missingTopic = await handleScoreClaim({
      claim: 'W0 collapse note: missing topic',
    });
    expect(researchRun.networkReceipt.arcanumType).toBe('uvrn-research');
    expect(missingTopic.networkReceipt.arcanumType).toBe('uvrn-research');
  });
});
