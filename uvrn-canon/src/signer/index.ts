// ─────────────────────────────────────────────────────────────
// @uvrn/canon — signer
// SHA-256 content hashing + ed25519 signing.
// The hash IS the immutability guarantee.
// The signature IS the trust guarantee.
//
// Two implementations:
//   NodeSigner  — for Node.js (server, CLI, agent)
//   WebSigner   — for browsers / Cloudflare Workers (WebCrypto)
// ─────────────────────────────────────────────────────────────

import * as nodeCrypto from 'crypto';
import { canonicalSerialize } from '@uvrn/core';
import type { CanonSigner } from '../types/index';

// Re-export core's canonical serialization so receipt hashes match SDK and core.
export const canonicalJson = canonicalSerialize;

// ── SHA-256 hash ──────────────────────────────────────────
// Works in Node.js and Cloudflare Workers.
//
export async function sha256(data: string): Promise<string> {
  // Cloudflare Workers / browser — WebCrypto
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(data);
    const hash    = await crypto.subtle.digest('SHA-256', encoded);
    return bufferToHex(hash);
  }

  // Node.js fallback
  const { createHash } = await import('crypto');
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Node.js signer (ed25519) ──────────────────────────────
// Use in server environments — Node 16+.
// Generates a fresh key pair or accepts an existing private key.
//
export class NodeSigner implements CanonSigner {
  private privKeyB64: string;
  private pubKeyB64:  string;

  constructor(privateKeyB64?: string) {
    if (privateKeyB64) {
      this.privKeyB64 = privateKeyB64;
      this.pubKeyB64  = '';
      this.pubKeyB64  = this.derivePublicKey(privateKeyB64);
    } else {
      const { publicKey, privateKey } = this.generateKeyPair();
      this.privKeyB64 = privateKey;
      this.pubKeyB64  = publicKey;
    }
  }

  async sign(data: string): Promise<string> {
    const { createPrivateKey, sign: nodSign } = await import('crypto');
    const key = createPrivateKey({
      key:    Buffer.from(this.privKeyB64, 'base64'),
      format: 'der',
      type:   'pkcs8',
    });
    const sig = nodSign(null, Buffer.from(data, 'utf8'), key);
    return sig.toString('base64');
  }

  async verify(data: string, sig: string): Promise<boolean> {
    return this.verifyWithPublicKey(data, sig, this.pubKeyB64);
  }

  async verifyWithPublicKey(data: string, sig: string, publicKeyB64: string): Promise<boolean> {
    try {
      const { createPublicKey, verify: nodVerify } = await import('crypto');
      const key = createPublicKey({
        key:    Buffer.from(publicKeyB64, 'base64'),
        format: 'der',
        type:   'spki',
      });
      return nodVerify(
        null,
        Buffer.from(data, 'utf8'),
        key,
        Buffer.from(sig, 'base64')
      );
    } catch {
      return false;
    }
  }

  publicKey(): string {
    return this.pubKeyB64;
  }

  private generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding:  { type: 'spki',  format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    return {
      publicKey:  (publicKey as Buffer).toString('base64'),
      privateKey: (privateKey as Buffer).toString('base64'),
    };
  }

  private derivePublicKey(privKeyB64: string): string {
    const privKey = nodeCrypto.createPrivateKey({
      key:    Buffer.from(privKeyB64, 'base64'),
      format: 'der',
      type:   'pkcs8',
    });
    const pubKey = nodeCrypto.createPublicKey(privKey);
    return (pubKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('base64');
  }
}

// ── Mock signer (testing only) ────────────────────────────
// Produces deterministic fake signatures. Never use in production.
//
export class MockSigner implements CanonSigner {
  private _pubKey = 'MOCK_PUBLIC_KEY_BASE64';

  async sign(data: string): Promise<string> {
    const hash = await sha256(data);
    return `MOCK_SIG:${hash.slice(0, 32)}`;
  }

  async verify(data: string, sig: string): Promise<boolean> {
    return this.verifyWithPublicKey(data, sig, this._pubKey);
  }

  async verifyWithPublicKey(data: string, sig: string, publicKeyB64: string): Promise<boolean> {
    if (publicKeyB64 !== this._pubKey) return false;
    const hash = await sha256(data);
    return sig === `MOCK_SIG:${hash.slice(0, 32)}`;
  }

  publicKey(): string {
    return this._pubKey;
  }
}
