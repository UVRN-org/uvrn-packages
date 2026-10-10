#!/usr/bin/env node
/**
 * Regenerates the SPEC/vectors/ conformance fixtures (SPEC/uvrn-receipt-v1.md §6).
 * Run from uvrn-receipt/ after `pnpm run build`:  node scripts/generate-vectors.js
 * Uses a FIXED Ed25519 seed so every vector is reproducible (Ed25519 is deterministic).
 */

const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { createHash } = require('crypto');
const core = require('@uvrn/core');
const receipt = require('../dist');

const VECTORS_DIR = join(__dirname, '..', '..', 'SPEC', 'vectors');
mkdirSync(VECTORS_DIR, { recursive: true });

// ---- fixed key material (test-only; never use for real receipts) ----
const SEED = Buffer.from('uvrn-spec-vector-seed-0000000001').toString('base64'); // 32 ASCII bytes
const PUBLIC_KEY_REF = 'uvrn-spec-pk-2026-v1';
const { createPrivateKey, createPublicKey } = require('crypto');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const priv = createPrivateKey({
  key: Buffer.concat([PKCS8_PREFIX, Buffer.from(SEED, 'base64')]),
  format: 'der',
  type: 'pkcs8',
});
const spki = createPublicKey(priv).export({ format: 'der', type: 'spki' });
const PUBLIC_KEY = spki.subarray(spki.length - 32).toString('base64');

const sha256Hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// ---- 1. canonicalization vectors ----
const canonicalCases = [
  { name: 'key-sorting', value: { b: 2, a: 1, c: { z: 1, y: 2 } } },
  { name: 'unicode-string', value: { text: 'héllo "quoted" é—' } },
  { name: 'numbers', value: { tiny: 0.000001, big: 1e21, negative: -0.5, zero: 0, int: 42 } },
  { name: 'arrays-and-null', value: { list: [1, 'two', null, [3]], empty: [], nul: null } },
  { name: 'empty-object', value: {} },
  {
    name: 'delta-receipt-shape',
    value: {
      bundleId: 'bundle-vector-1',
      deltaFinal: 0.042,
      outcome: 'consensus',
      rounds: [{ round: 1, deltasByMetric: { price: 0.042 }, withinThreshold: true, witnessRequired: false }],
      sources: ['Source A', 'Source B'],
      suggestedFixes: [],
      ts: '2026-06-10T12:00:00.000Z',
    },
  },
].map(({ name, value }) => {
  const canonical = receipt.canonicalize(value);
  return { name, value, canonical, sha256Hex: sha256Hex(canonical) };
});

writeFileSync(
  join(VECTORS_DIR, 'canonical.json'),
  JSON.stringify({ spec: 'uvrn-receipt-v1 §1 (uvrn-jcs-1)', cases: canonicalCases }, null, 2)
);

// ---- 2. network receipt vector (delta payload, signed) ----
const deltaPayload = {
  bundleId: 'bundle-vector-1',
  deltaFinal: 0.042,
  sources: ['Source A', 'Source B', 'Source C'],
  rounds: [{ round: 1, deltasByMetric: { price: 0.042 }, withinThreshold: true, witnessRequired: false }],
  suggestedFixes: [],
  outcome: 'consensus',
  ts: '2026-06-10T12:00:00.000Z',
};
const delta = { ...deltaPayload, hash: core.hashReceipt(deltaPayload) };

const unsigned = receipt.wrapDeltaReceipt(delta, {
  claim: 'BTC traded above 100k on 2026-06-09',
  source: 'uvrn-sdk',
  action: 'delta.consensus',
  occurredAt: '2026-06-10T12:00:00.000Z',
  topic: 'markets/crypto/BTC',
  tags: ['spec-vector'],
});
const signed = receipt.signReceipt(unsigned, {
  privateKey: SEED,
  publicKeyRef: PUBLIC_KEY_REF,
  signedAt: '2026-06-10T12:10:00.000Z',
});

const tamperedBody = JSON.parse(JSON.stringify(signed));
tamperedBody.claim.text = 'BTC traded above 200k on 2026-06-09';
const tamperedSignature = JSON.parse(JSON.stringify(signed));
tamperedSignature.signature.sig =
  (tamperedSignature.signature.sig[0] === 'A' ? 'B' : 'A') + tamperedSignature.signature.sig.slice(1);

writeFileSync(
  join(VECTORS_DIR, 'network-receipt.json'),
  JSON.stringify(
    {
      spec: 'uvrn-receipt-v1 §2.4/§3, uvrn-signing-v1 §2',
      keys: { privateKeySeed: SEED, publicKey: PUBLIC_KEY, publicKeyRef: PUBLIC_KEY_REF },
      receipt: signed,
      expect: { receiptHash: signed.receiptHash, baseDeltaHash: delta.hash, verified: true },
      mustFail: [
        { reason: 'tampered claim text — integrity check fails', receipt: tamperedBody },
        { reason: 'tampered signature — signature check fails', receipt: tamperedSignature },
      ],
    },
    null,
    2
  )
);

// ---- 3. master receipt vector with HumanView ----
const master = core.buildMasterReceipt({
  base: delta,
  claim: 'BTC traded above 100k on 2026-06-09',
  timestamp: '2026-06-10T12:05:00.000Z',
  measurements: [
    {
      type: 'agree',
      verdict: 'agree',
      confidence: 0.96,
      explanation: 'Sources converge with agreement score 0.960 at threshold 0.9.',
      evidenceRefs: ['source-a', 'source-b'],
    },
    {
      type: 'disagree',
      verdict: 'none',
      confidence: 0.96,
      explanation: 'Numeric spread 0.040 does not exceed disagreement threshold 0.1.',
      evidenceRefs: ['source-a', 'source-b'],
    },
  ],
  nodes: [
    { id: 'source-a', status: 'on' },
    { id: 'source-b', status: 'on' },
    { id: 'source-c', status: 'unavailable', detail: 'timeout after 5s' },
  ],
});
const wrappedMaster = receipt.wrapMasterReceipt(master, {
  claim: 'BTC traded above 100k on 2026-06-09',
  source: 'uvrn-sdk',
  action: 'master.measured',
  occurredAt: '2026-06-10T12:05:00.000Z',
  topic: 'markets/crypto/BTC',
});
const humanView = receipt.toHumanView(wrappedMaster, {
  scores: { vScore: 85.5, completeness: 0.67, parity: 0.96, freshness: 1 },
});

writeFileSync(
  join(VECTORS_DIR, 'master-receipt.json'),
  JSON.stringify(
    {
      spec: 'uvrn-receipt-v1 §2.2, plan B4/B5',
      master,
      expect: { masterHash: master.masterHash },
      networkReceipt: wrappedMaster,
      humanView,
    },
    null,
    2
  )
);

console.log(`Vectors written to ${VECTORS_DIR}`);
console.log(`  canonical cases: ${canonicalCases.length}`);
console.log(`  network receiptHash: ${signed.receiptHash}`);
console.log(`  master masterHash:   ${master.masterHash}`);
