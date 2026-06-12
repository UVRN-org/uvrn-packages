import {
  assembleHashInput,
  assembleLegacyHashInput,
  canonicalize,
  formatReceiptHash,
  NETWORK_RECEIPT_HASH_FIELDS,
  RECEIPT_HASH_PATTERN,
} from '../src/canonical';

describe('canonicalize (RFC 8785 JCS)', () => {
  it('sorts object keys lexicographically with no whitespace', () => {
    expect(canonicalize({ b: 2, a: 1, c: { z: 1, y: 2 } })).toBe('{"a":1,"b":2,"c":{"y":2,"z":1}}');
  });

  it('serializes primitives like JSON.stringify', () => {
    expect(canonicalize('héllo "quoted"')).toBe(JSON.stringify('héllo "quoted"'));
    expect(canonicalize(0.000001)).toBe('0.000001');
    expect(canonicalize(1e21)).toBe('1e+21');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(null)).toBe('null');
  });

  it('omits undefined object members and nullifies undefined array elements', () => {
    expect(canonicalize({ a: 1, gone: undefined })).toBe('{"a":1}');
    expect(canonicalize([1, undefined, 2])).toBe('[1,null,2]');
  });

  it('throws on non-finite numbers and top-level undefined', () => {
    expect(() => canonicalize({ bad: NaN })).toThrow('non-finite');
    expect(() => canonicalize({ bad: Infinity })).toThrow('non-finite');
    expect(() => canonicalize(undefined)).toThrow('top-level');
  });

  it('matches @uvrn/core canonicalSerialize for JSON-representable values', () => {
    const { canonicalSerialize } = require('@uvrn/core');
    const sample = { z: [1, 2, { b: 'x', a: 'y' }], a: 0.5, nested: { deep: null } };
    expect(canonicalize(sample)).toBe(canonicalSerialize(sample));
  });
});

describe('assembleHashInput (uvrn-receipt-4 declared field list)', () => {
  const base = {
    schemaVersion: 'uvrn-receipt-4',
    kind: 'delta',
    claim: { id: 'c-1', text: 'claim' },
    source: 'uvrn-sdk',
    action: 'delta.consensus',
    occurredAt: '2026-06-10T12:00:00.000Z',
    payload: { hash: 'abc' },
  };

  it('includes optional fields only when present', () => {
    expect(Object.keys(assembleHashInput(base)).sort()).toEqual(
      ['action', 'claim', 'kind', 'occurredAt', 'payload', 'schemaVersion', 'source'].sort()
    );
    const withTopic = assembleHashInput({ ...base, topic: 'markets/crypto/BTC', tags: ['t'] });
    expect(withTopic.topic).toBe('markets/crypto/BTC');
    expect(withTopic.tags).toEqual(['t']);
  });

  it('ignores fields outside the declared list (unknown-field rule)', () => {
    const input = assembleHashInput({
      ...base,
      receiptHash: 'sha256:deadbeef',
      signature: { alg: 'ed25519', publicKeyRef: 'x', sig: 'y' },
      futureField: 'ignored',
    });
    expect(input.receiptHash).toBeUndefined();
    expect(input.signature).toBeUndefined();
    expect(input.futureField).toBeUndefined();
  });

  it('throws when a required field is missing', () => {
    const { payload, ...rest } = base;
    expect(() => assembleHashInput(rest)).toThrow('required field "payload"');
  });

  it('declares exactly the SPEC §2.4 list', () => {
    expect([...NETWORK_RECEIPT_HASH_FIELDS]).toEqual([
      'schemaVersion', 'kind', 'claim', 'source', 'action', 'occurredAt', 'payload',
      'topic', 'tags', 'narrative', 'links', 'chainId', 'sdk',
    ]);
  });
});

describe('assembleLegacyHashInput (drvc3-receipt-1, frozen)', () => {
  it('reproduces the worker field list with optional tail', () => {
    const record = {
      schemaVersion: 'drvc3-receipt-1',
      source: 's',
      action: 'a',
      payload: {},
      occurredAt: '2026-06-10T12:00:00.000Z',
      sdk: { name: 'uvrn-sdk', version: '3.0.0', integrityHash: 'h' },
      narrative: 'n',
      ignoredExtra: true,
    };
    const input = assembleLegacyHashInput(record);
    expect(Object.keys(input).sort()).toEqual(
      ['action', 'narrative', 'occurredAt', 'payload', 'schemaVersion', 'sdk', 'source'].sort()
    );
    expect((input as Record<string, unknown>).ignoredExtra).toBeUndefined();
  });

  it('requires sdk (legacy contract)', () => {
    expect(() =>
      assembleLegacyHashInput({
        schemaVersion: 'x', source: 's', action: 'a', payload: {}, occurredAt: 't',
      })
    ).toThrow('required field "sdk"');
  });
});

describe('hash formatting', () => {
  it('formats and matches the prefixed pattern', () => {
    const hex = 'a'.repeat(64);
    expect(formatReceiptHash(hex)).toBe(`sha256:${hex}`);
    expect(RECEIPT_HASH_PATTERN.test(formatReceiptHash(hex))).toBe(true);
    expect(RECEIPT_HASH_PATTERN.test('sha256:XYZ')).toBe(false);
  });
});
