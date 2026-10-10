import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  assembleHashInput,
  canonicalize,
  NETWORK_RECEIPT_HASH_FIELDS,
} from '@uvrn/receipt';
import { hashReceipt, type DeltaReceipt } from '@uvrn/core';
import {
  DELIBERATELY_UNMAPPED_FIELDS,
  OFFLINE_LINKED_DATA_VALIDATOR,
  expandOffline,
  offlineDocumentLoader,
  projectReceiptToJsonLd,
  UVRN_RECEIPT_CONTEXT_IRI,
} from '../src';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function makeNetworkReceipt(
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const receipt: Record<string, unknown> = {
    schemaVersion: 'uvrn-receipt-4',
    kind: 'delta',
    claim: { id: 'claim-k21', text: 'US unemployment in May 2026 was 2.0%' },
    source: 'uvrn-test',
    action: 'delta.consensus',
    occurredAt: '2026-05-10T12:00:00.000Z',
    payload: {
      bundleId: 'k21-payload',
      deltaFinal: 0,
      sources: ['a', 'b'],
      rounds: [],
      suggestedFixes: [],
      outcome: 'consensus',
      ts: '2026-05-10T12:00:00.000Z',
      hostSources: [
        {
          url: 'https://fixture.uvrn.example/K21/a',
          value: 2.05,
          unit: '%',
          quantityKind: 'percentage',
          measuredAt: '2026-05-01T12:00:00.000Z',
          obsStatus: 'A',
          prov: { hadPrimarySource: 'https://fixture.uvrn.example/K21/primary-bls' },
        },
        {
          url: 'https://fixture.uvrn.example/K21/b',
          value: 2.05,
          unit: '%',
          quantityKind: 'percentage',
          measuredAt: '2026-05-01T12:00:00.000Z',
          obsStatus: 'A',
          // undeclared PROV — must stay undeclared in graph
        },
      ],
    },
    topic: 'markets/macro/UNRATE',
    tags: ['provenance:declared'],
    ...extras,
  };
  const input = assembleHashInput(receipt);
  receipt.receiptHash = `sha256:${sha256Hex(canonicalize(input))}`;
  return receipt;
}

describe('BP-21 JSON-LD projection', () => {
  test('named offline validator identity', () => {
    expect(OFFLINE_LINKED_DATA_VALIDATOR.name).toBe('jsonld.js');
    expect(OFFLINE_LINKED_DATA_VALIDATOR.package).toBe('jsonld');
    expect(OFFLINE_LINKED_DATA_VALIDATOR.mode).toBe('offline-documentLoader');
  });

  test('C1: projection is a separate object; input never mutated', () => {
    const receipt = makeNetworkReceipt();
    const before = JSON.stringify(receipt);
    const projection = projectReceiptToJsonLd(receipt);
    expect(JSON.stringify(receipt)).toBe(before);
    expect(projection).not.toBe(receipt);
    expect(receipt['@context']).toBeUndefined();
    expect(projection['@context']).toBe(UVRN_RECEIPT_CONTEXT_IRI);
  });

  test('C2/F1: @context absent from assembleHashInput / JCS bytes', () => {
    const receipt = makeNetworkReceipt();
    const projection = projectReceiptToJsonLd(receipt);
    // Mutating the *projection* must not affect hash input of the receipt
    void projection;
    const input = assembleHashInput(receipt);
    expect(input).not.toHaveProperty('@context');
    const canonical = canonicalize(input);
    expect(canonical.includes('@context')).toBe(false);
    for (const field of NETWORK_RECEIPT_HASH_FIELDS) {
      expect(field).not.toBe('@context');
    }
  });

  test('hash invariance: hashing before/after project is identical', () => {
    const receipt = makeNetworkReceipt();
    const h1 = receipt.receiptHash;
    projectReceiptToJsonLd(receipt);
    const h2 = `sha256:${sha256Hex(canonicalize(assembleHashInput(receipt)))}`;
    expect(h2).toBe(h1);
  });

  test('DeltaReceipt hashReceipt unchanged by projection capability', () => {
    const payload: Omit<DeltaReceipt, 'hash'> = {
      bundleId: 'bp21-delta',
      deltaFinal: 0.01,
      sources: ['A', 'B'],
      rounds: [
        {
          round: 1,
          deltasByMetric: { v: 0.01 },
          withinThreshold: true,
          witnessRequired: false,
        },
      ],
      suggestedFixes: [],
      outcome: 'consensus',
      ts: '2026-05-10T12:00:00.000Z',
    };
    const h1 = hashReceipt(payload);
    projectReceiptToJsonLd({
      schemaVersion: 'uvrn-receipt-4',
      kind: 'delta',
      claim: { id: 'x', text: 't' },
      source: 't',
      action: 'a',
      occurredAt: payload.ts,
      payload: { ...payload, hash: h1 },
    });
    expect(hashReceipt(payload)).toBe(h1);
  });

  test('C4: undeclared PROV stays undeclared; declared edges project', () => {
    const receipt = makeNetworkReceipt();
    const projection = projectReceiptToJsonLd(receipt);
    const withProv = projection.observations.find((o) =>
      Boolean(o.hadPrimarySource),
    );
    const without = projection.observations.find(
      (o) => o['@id'] === 'https://fixture.uvrn.example/K21/b',
    );
    expect(withProv?.hadPrimarySource).toBe(
      'https://fixture.uvrn.example/K21/primary-bls',
    );
    expect(without).toBeDefined();
    expect(without?.wasDerivedFrom).toBeUndefined();
    expect(without?.hadPrimarySource).toBeUndefined();
    expect(without?.wasQuotedFrom).toBeUndefined();
  });

  test('C5: deliberately unmapped fields listed; payload not re-asserted as typed claims', () => {
    const projection = projectReceiptToJsonLd(makeNetworkReceipt());
    expect(projection.omittedFields).toEqual(
      expect.arrayContaining([...DELIBERATELY_UNMAPPED_FIELDS]),
    );
    expect(projection.payload).toBeUndefined();
  });

  test('C3/F8: offline expand succeeds; remote context refused', async () => {
    const projection = projectReceiptToJsonLd(makeNetworkReceipt());
    const expanded = await expandOffline(projection);
    expect(Array.isArray(expanded)).toBe(true);
    expect(expanded.length).toBeGreaterThan(0);
    await expect(
      offlineDocumentLoader('https://example.com/remote-context.jsonld'),
    ).rejects.toThrow(/refused/);
  });

  test('golden + case-bank corpus: projection does not alter NetworkReceipt hashes', () => {
    const root = join(__dirname, '..', '..');
    const caseBankPath = join(root, 'uvrn-case-bank', 'fixtures', 'cases', 'K21.json');
    if (!existsSync(caseBankPath)) {
      // Public export excludes case-bank; use inline typed-observation fixture.
      const receipt = makeNetworkReceipt({
        payload: {
          ...(makeNetworkReceipt().payload as object),
          caseId: 'K21-inline',
          hostSources: [{ id: 'src-1', label: 'fixture', observations: [] }],
        },
      });
      const before = `sha256:${sha256Hex(canonicalize(assembleHashInput(receipt)))}`;
      const projection = projectReceiptToJsonLd(receipt);
      const after = `sha256:${sha256Hex(canonicalize(assembleHashInput(receipt)))}`;
      expect(after).toBe(before);
      expect(projection['@context']).toBe(UVRN_RECEIPT_CONTEXT_IRI);
      return;
    }
    const caseBank = JSON.parse(readFileSync(caseBankPath, 'utf8')) as Record<string, unknown>;
    const receipt = makeNetworkReceipt({
      payload: {
        ...(makeNetworkReceipt().payload as object),
        caseId: caseBank.id,
        hostSources: caseBank.sources,
      },
    });
    const before = `sha256:${sha256Hex(canonicalize(assembleHashInput(receipt)))}`;
    const projection = projectReceiptToJsonLd(receipt);
    const after = `sha256:${sha256Hex(canonicalize(assembleHashInput(receipt)))}`;
    expect(after).toBe(before);
    expect(projection['@context']).toBe(UVRN_RECEIPT_CONTEXT_IRI);
    expect(JSON.stringify(assembleHashInput(receipt)).includes('@context')).toBe(
      false,
    );
  });
});
