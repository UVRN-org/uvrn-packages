import { verifyMasterReceipt, verifyReceipt } from '@uvrn/core';
import {
  claimIdFromText,
  computeNetworkReceiptHash,
  generateReceiptKeyPair,
  signReceipt,
  validateNetworkReceipt,
  verifyReceiptFull,
  verifySignature,
  wrapDeltaReceipt,
  wrapMasterReceipt,
} from '../src';
import { makeDeltaReceipt, makeMasterReceipt } from './fixtures';

describe('claimIdFromText', () => {
  it('derives a slug plus 8-char sha256 suffix, collision-safe', () => {
    const id = claimIdFromText('BTC traded above 100k on 2026-06-09');
    expect(id).toMatch(/^btc-traded-above-100k-on-2026-06-09-[0-9a-f]{8}$/);
    expect(claimIdFromText('a!!!')).toMatch(/^a-[0-9a-f]{8}$/);
    expect(claimIdFromText('x')).not.toBe(claimIdFromText('y'));
  });
});

describe('wrapDeltaReceipt', () => {
  const delta = makeDeltaReceipt();
  const wrapped = wrapDeltaReceipt(delta, {
    claim: 'BTC traded above 100k on 2026-06-09',
    source: 'uvrn-sdk',
    action: 'delta.consensus',
    topic: 'markets/crypto/BTC',
    tags: ['fixture'],
  });

  it('produces a schema-valid uvrn-receipt-4 envelope', () => {
    const outcome = validateNetworkReceipt(wrapped);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
    expect(wrapped.kind).toBe('delta');
    expect(wrapped.occurredAt).toBe(delta.ts);
  });

  it('keeps the payload byte-for-byte and the base receipt independently verifiable', () => {
    expect(wrapped.payload).toBe(delta as unknown as Record<string, unknown>);
    expect(verifyReceipt(wrapped.payload as never).verified).toBe(true);
  });

  it('computes a stable hash that survives additive unknown fields', () => {
    expect(computeNetworkReceiptHash(wrapped)).toBe(wrapped.receiptHash);
    const withExtra = { ...wrapped, futureEnvelopeField: 'anything' };
    expect(computeNetworkReceiptHash(withExtra)).toBe(wrapped.receiptHash);
  });

  it('fails hash recompute on a tampered envelope', () => {
    const tampered = { ...wrapped, narrative: 'injected after hashing' };
    expect(computeNetworkReceiptHash(tampered)).not.toBe(wrapped.receiptHash);
  });
});

describe('wrapMasterReceipt', () => {
  const master = makeMasterReceipt();
  const wrapped = wrapMasterReceipt(master, {
    claim: master.claim,
    source: 'uvrn-sdk',
    action: 'master.measured',
    topic: 'markets/crypto/BTC',
  });

  it('is schema-valid with a generated vocabulary narrative', () => {
    const outcome = validateNetworkReceipt(wrapped);
    expect(outcome.errors).toEqual([]);
    expect(wrapped.narrative).toContain('Sources align');
    expect(wrapped.narrative).toContain('2 of 3 sources');
    expect(wrapped.narrative!.length).toBeLessThanOrEqual(500);
  });

  it('keeps the master payload verifiable through the core path', () => {
    expect(verifyMasterReceipt(wrapped.payload as never).verified).toBe(true);
  });
});

describe('signReceipt / verifySignature / verifyReceiptFull', () => {
  const keys = generateReceiptKeyPair();
  const ref = 'test-pk-2026-v1';
  const delta = makeDeltaReceipt();
  const unsigned = wrapDeltaReceipt(delta, {
    claim: 'BTC traded above 100k on 2026-06-09',
    source: 'uvrn-sdk',
    action: 'delta.consensus',
  });
  const signed = signReceipt(unsigned, {
    privateKey: keys.privateKey,
    publicKeyRef: ref,
    signedAt: '2026-06-10T12:10:00.000Z',
  });

  it('attaches a verifying ed25519 signature without mutating the input', () => {
    expect(unsigned.signature).toBeUndefined();
    expect(signed.signature?.alg).toBe('ed25519');
    expect(verifySignature(signed, keys.publicKey).signatureOk).toBe(true);
  });

  it('signature does not change the receipt hash (additive rule)', () => {
    expect(signed.receiptHash).toBe(unsigned.receiptHash);
    expect(computeNetworkReceiptHash(signed)).toBe(signed.receiptHash);
  });

  it('verifyReceiptFull = integrity + signature via key map', () => {
    const result = verifyReceiptFull(signed, { keys: { [ref]: keys.publicKey } });
    expect(result).toMatchObject({ verified: true, integrityOk: true, signatureOk: true, signed: true });
  });

  it('an unsigned receipt is integrity-checked but never verified (honest vocabulary)', () => {
    const result = verifyReceiptFull(unsigned);
    expect(result.integrityOk).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('integrity-checked only');
  });

  it('fails loudly on unresolvable key, wrong key, and tampering', () => {
    expect(verifyReceiptFull(signed).error).toContain('KEY_NOT_FOUND');

    const wrongKey = generateReceiptKeyPair().publicKey;
    expect(verifyReceiptFull(signed, { publicKey: wrongKey }).verified).toBe(false);

    const tamperedBody = { ...signed, claim: { id: signed.claim.id, text: 'rewritten claim' } };
    const tamperedResult = verifyReceiptFull(tamperedBody, { publicKey: keys.publicKey });
    expect(tamperedResult.integrityOk).toBe(false);
    expect(tamperedResult.verified).toBe(false);

    const tamperedSig = {
      ...signed,
      signature: { ...signed.signature!, sig: signed.signature!.sig.replace(/^./, 'A') },
    };
    expect(verifyReceiptFull(tamperedSig, { publicKey: keys.publicKey }).signatureOk).toBe(false);
  });

  it('refuses to sign a receipt whose hash does not verify', () => {
    const broken = { ...unsigned, receiptHash: 'sha256:' + '0'.repeat(64) };
    expect(() => signReceipt(broken, { privateKey: keys.privateKey, publicKeyRef: ref })).toThrow(
      'does not verify'
    );
  });
});
