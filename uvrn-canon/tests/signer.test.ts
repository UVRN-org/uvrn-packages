// ─────────────────────────────────────────────────────────────
// @uvrn/canon — signer unit tests
// NodeSigner (ed25519), MockSigner, sha256, canonicalJson
// ─────────────────────────────────────────────────────────────

import { NodeSigner, MockSigner, sha256, canonicalJson } from '../src/signer/index';

describe('sha256()', () => {
  it('produces the known SHA-256 vector for "abc"', async () => {
    await expect(sha256('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('is deterministic and changes with input', async () => {
    const a1 = await sha256('uvrn');
    const a2 = await sha256('uvrn');
    const b = await sha256('uvrn!');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalJson()', () => {
  it('serializes key-order-independently (matches core canonicalSerialize)', () => {
    const left = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const right = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(left).toBe(right);
  });
});

describe('NodeSigner', () => {
  it('generates a key pair and round-trips sign → verify', async () => {
    const signer = new NodeSigner();
    const data = 'canon content hash payload';
    const sig = await signer.sign(data);

    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
    expect(signer.publicKey().length).toBeGreaterThan(0);
    await expect(signer.verify(data, sig)).resolves.toBe(true);
  });

  it('rejects tampered data and tampered signatures', async () => {
    const signer = new NodeSigner();
    const sig = await signer.sign('original');

    await expect(signer.verify('tampered', sig)).resolves.toBe(false);
    const tamperedSig = Buffer.from('not-a-real-signature-payload-data!!!').toString('base64');
    await expect(signer.verify('original', tamperedSig)).resolves.toBe(false);
  });

  it('rejects verification under a different key pair', async () => {
    const alice = new NodeSigner();
    const mallory = new NodeSigner();
    const sig = await alice.sign('claim data');

    await expect(
      mallory.verifyWithPublicKey('claim data', sig, mallory.publicKey())
    ).resolves.toBe(false);
    await expect(
      mallory.verifyWithPublicKey('claim data', sig, alice.publicKey())
    ).resolves.toBe(true);
  });

  it('returns false (never throws) for a malformed public key', async () => {
    const signer = new NodeSigner();
    const sig = await signer.sign('data');
    await expect(signer.verifyWithPublicKey('data', sig, '%%%not-base64-der%%%')).resolves.toBe(
      false
    );
  });

  it('derives the public key when constructed from an existing private key', async () => {
    const original = new NodeSigner();
    // Round-trip the generated private key through a fresh signer instance.
    const privateKey = (original as unknown as { privKeyB64: string }).privKeyB64;
    const restored = new NodeSigner(privateKey);

    expect(restored.publicKey()).toBe(original.publicKey());

    const sig = await restored.sign('restored key payload');
    await expect(original.verify('restored key payload', sig)).resolves.toBe(true);
  });
});

describe('MockSigner', () => {
  it('produces deterministic mock signatures that verify', async () => {
    const signer = new MockSigner();
    const sig1 = await signer.sign('data');
    const sig2 = await signer.sign('data');

    expect(sig1).toBe(sig2);
    expect(sig1.startsWith('MOCK_SIG:')).toBe(true);
    await expect(signer.verify('data', sig1)).resolves.toBe(true);
  });

  it('fails verification for wrong data, wrong sig, or wrong public key', async () => {
    const signer = new MockSigner();
    const sig = await signer.sign('data');

    await expect(signer.verify('other data', sig)).resolves.toBe(false);
    await expect(signer.verify('data', 'MOCK_SIG:bogus')).resolves.toBe(false);
    await expect(signer.verifyWithPublicKey('data', sig, 'SOME_OTHER_KEY')).resolves.toBe(false);
  });

  it('exposes the fixed mock public key', () => {
    expect(new MockSigner().publicKey()).toBe('MOCK_PUBLIC_KEY_BASE64');
  });
});
