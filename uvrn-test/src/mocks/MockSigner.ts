import { createHash } from 'node:crypto';

import type { CanonSigner } from '@uvrn/canon';

import type { MockSignedEnvelope, MockSignerOptions } from '../types';

function encode(value: string): string {
  return createHash('sha256').update(value).digest('base64');
}

export class MockSigner implements CanonSigner {
  readonly address: string;

  constructor(options: MockSignerOptions = {}) {
    this.address = options.address ?? '0xMOCKSIGNER';
  }

  async sign(data: string): Promise<string>;
  async sign(receipt: unknown): Promise<MockSignedEnvelope>;
  async sign(input: string | unknown): Promise<string | MockSignedEnvelope> {
    if (typeof input === 'string') {
      return encode(`${this.address}:${input}`);
    }

    const payload = JSON.stringify(input);
    return {
      signature: encode(`${this.address}:${payload}`),
      address: this.address,
      receipt: input,
    };
  }

  publicKey(): string {
    return encode(`public:${this.address}`);
  }

  async verify(data: string, sig: string): Promise<boolean> {
    return sig === encode(`${this.address}:${data}`);
  }

  async verifyWithPublicKey(data: string, sig: string, publicKeyB64: string): Promise<boolean> {
    return publicKeyB64 === this.publicKey() && sig === encode(`${this.address}:${data}`);
  }
}
