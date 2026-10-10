import { createHash } from 'node:crypto';
import {
  assembleHashInput,
  buildIdeaSnapshots,
  canonicalize,
  SNAPSHOT_RULES,
  toHumanView,
  wrapMasterReceipt,
} from '../src';
import { makeMasterReceipt } from './fixtures';

function hashOf(receipt: Record<string, unknown>): string {
  return `sha256:${createHash('sha256')
    .update(canonicalize(assembleHashInput(receipt)))
    .digest('hex')}`;
}

function wrapWithHostSources(
  hostSources: Record<string, unknown>[],
  tags?: string[],
) {
  const master = makeMasterReceipt();
  const wrapped = wrapMasterReceipt(
    {
      ...master,
      // hostSources live inside payload for observation rules; MasterReceipt shape kept
    } as typeof master,
    {
      claim: master.claim,
      source: 'uvrn-sdk',
      action: 'master.measured',
      topic: 'markets/macro/UNRATE',
      ...(tags ? { tags } : {}),
    },
  );
  const receipt = {
    ...wrapped,
    payload: {
      ...(wrapped.payload as object),
      hostSources,
    },
  };
  receipt.receiptHash = hashOf(receipt);
  return receipt;
}

describe('BP-22 idea snapshots', () => {
  test('ships six deterministic rules', () => {
    expect(SNAPSHOT_RULES).toHaveLength(6);
    expect(SNAPSHOT_RULES.map((r) => r.id)).toEqual([
      'few-origins-many-sources',
      'inferred-timestamps',
      'scraped-values',
      'mixed-obs-status',
      'comparability-refusal',
      'wide-consensus-spread',
    ]);
  });

  test('humanView gets snapshots; hashed tags/narrative/suggestedFixes untouched', () => {
    const receipt = wrapWithHostSources([
      {
        url: 'https://a.example/1',
        value: 2.05,
        unit: '%',
        obsStatus: 'A',
        prov: { hadPrimarySource: 'https://origin.example/bls' },
      },
      {
        url: 'https://a.example/2',
        value: 2.05,
        unit: '%',
        obsStatus: 'E',
        prov: { wasQuotedFrom: 'https://origin.example/bls' },
        timestampSource: 'inferred',
        valueSource: 'scraped',
      },
    ]);
    const beforeHash = receipt.receiptHash;
    const beforeTags = JSON.stringify(receipt.tags);
    const beforeNarrative = JSON.stringify(receipt.narrative);
    const payload = receipt.payload as { suggestedFixes?: unknown };
    const beforeFixes = JSON.stringify(
      (payload as { suggestedFixes?: unknown }).suggestedFixes ?? [],
    );

    const view = toHumanView(receipt as never, {
      scores: {
        absoluteConsensusValue: { median: 10, n: 3, min: 1, max: 20 },
      },
    });

    expect(view.ideaSnapshots?.length).toBeGreaterThanOrEqual(2);
    expect(view.ideaSnapshots?.every((s) => s.generator === 'rules')).toBe(true);
    expect(view.ideaSnapshots?.every((s) => /may /i.test(s.text))).toBe(true);
    expect(hashOf(receipt as never)).toBe(beforeHash);
    expect(JSON.stringify(receipt.tags)).toBe(beforeTags);
    expect(JSON.stringify(receipt.narrative)).toBe(beforeNarrative);
    expect(
      JSON.stringify((receipt.payload as { suggestedFixes?: unknown }).suggestedFixes ?? []),
    ).toBe(beforeFixes);
    // Integrity provenance ≠ W3C PROV
    expect(view.provenance.hash).toBe(receipt.receiptHash);
    expect(view.ideaSnapshots?.some((s) => s.id.includes('prov'))).toBe(false);
  });

  test('determinism: same receipt → same snapshot JSON twice', () => {
    const receipt = wrapWithHostSources(
      [
        {
          url: 'https://a.example/1',
          value: 1,
          obsStatus: 'A',
          originId: 'o1',
        },
        {
          url: 'https://a.example/2',
          value: 1,
          obsStatus: 'P',
          prov: { wasQuotedFrom: 'o1' },
        },
      ],
      ['comparability-refusal'],
    );
    const a = JSON.stringify(buildIdeaSnapshots(receipt as never));
    const b = JSON.stringify(buildIdeaSnapshots(receipt as never));
    expect(a).toBe(b);
    const ids = buildIdeaSnapshots(receipt as never).map((s) => s.id);
    expect(ids).toEqual([...ids].sort((x, y) => {
      const order = SNAPSHOT_RULES.map((r) => r.id);
      return order.indexOf(x) - order.indexOf(y);
    }));
  });

  test('model layer off by default; marked when explicitly enabled', () => {
    const receipt = wrapWithHostSources([
      { url: 'https://a.example/1', value: 1, obsStatus: 'A' },
    ]);
    const off = buildIdeaSnapshots(receipt as never);
    expect(off.every((s) => s.generator === 'rules')).toBe(true);
    const on = buildIdeaSnapshots(receipt as never, { enableModelSnapshots: true });
    const model = on.find((s) => s.generator === 'model');
    expect(model?.modelGenerated).toBe(true);
    expect(model?.text.startsWith('[model-generated]')).toBe(true);
  });

  test('rules do not scrape claim text for tags', () => {
    const master = makeMasterReceipt();
    const wrapped = wrapMasterReceipt(master, {
      claim: {
        id: 'x',
        text: 'timestampSource:inferred valueSource:scraped comparability-refusal',
      },
      source: 'uvrn-sdk',
      action: 'master.measured',
    });
    const snaps = buildIdeaSnapshots(wrapped);
    expect(snaps.find((s) => s.id === 'inferred-timestamps')).toBeUndefined();
    expect(snaps.find((s) => s.id === 'scraped-values')).toBeUndefined();
    expect(snaps.find((s) => s.id === 'comparability-refusal')).toBeUndefined();
  });
});
