import {
  buildMasterNarrative,
  DOMAIN_FRAMING,
  framingFor,
  isValidTopicString,
  normalizeTopic,
  parseTopic,
  formatTopic,
  SCORE_PLAIN_MEANING,
  STARTER_DOMAINS,
  validateNetworkReceipt,
  VERDICT_VOCABULARY,
  verdictHuman,
  WHY_DIVERGENCE_WINS,
} from '../src';
import { wrapDeltaReceipt } from '../src/envelope';
import { makeDeltaReceipt } from './fixtures';

describe('validateNetworkReceipt', () => {
  const valid = wrapDeltaReceipt(makeDeltaReceipt(), {
    claim: 'fixture claim',
    source: 'uvrn-sdk',
    action: 'delta.consensus',
  });

  it('accepts a valid envelope', () => {
    expect(validateNetworkReceipt(valid)).toEqual({ valid: true, errors: [] });
  });

  it('rejects malformed hash, missing claim, bad links, oversize narrative', () => {
    expect(validateNetworkReceipt({ ...valid, receiptHash: 'nope' }).errors).toContainEqual(
      expect.stringContaining('receiptHash')
    );
    expect(validateNetworkReceipt({ ...valid, claim: { id: '', text: 'x' } }).errors).toContainEqual(
      expect.stringContaining('claim')
    );
    expect(
      validateNetworkReceipt({ ...valid, links: [{ hash: 'sha256:zz', rel: 'follows' }] }).errors
    ).toContainEqual(expect.stringContaining('links[0].hash'));
    expect(
      validateNetworkReceipt({ ...valid, links: [{ hash: valid.receiptHash, rel: 'bogus' }] }).errors
    ).toContainEqual(expect.stringContaining('links[0].rel'));
    expect(
      validateNetworkReceipt({ ...valid, narrative: 'x'.repeat(501) }).errors
    ).toContainEqual(expect.stringContaining('narrative'));
  });

  it('requires narrative for kind master', () => {
    const master = { ...valid, kind: 'master' };
    expect(validateNetworkReceipt(master).errors).toContainEqual(
      expect.stringContaining('required for kind "master"')
    );
  });

  it('ignores unknown fields (forward compatibility)', () => {
    expect(validateNetworkReceipt({ ...valid, futureField: 1 }).valid).toBe(true);
  });
});

describe('topics', () => {
  it('parses and formats round-trip', () => {
    expect(parseTopic('markets/crypto/BTC')).toEqual({
      domain: 'markets', subject: 'crypto', instrument: 'BTC',
    });
    expect(formatTopic({ domain: 'products', subject: 'pod' })).toBe('products/pod');
  });

  it('accepts starter domains unchanged and folds unknown domains under custom/', () => {
    expect(normalizeTopic('markets/crypto/BTC')).toEqual({ topic: 'markets/crypto/BTC', normalized: false });
    expect(normalizeTopic('astrology/houses')).toEqual({ topic: 'custom/astrology/houses', normalized: true });
    expect(normalizeTopic('custom/anything')).toEqual({ topic: 'custom/anything', normalized: false });
  });

  it('sanitizes segments instead of rejecting (recorded, not hidden)', () => {
    expect(normalizeTopic('Markets/Crypto Coins/BTC').topic).toBe('markets/crypto-coins/BTC');
    expect(normalizeTopic('').topic).toBe('custom/unspecified');
  });

  it('validates canonical strings', () => {
    expect(isValidTopicString('markets/crypto/BTC')).toBe(true);
    expect(isValidTopicString('custom/astrology')).toBe(true);
    expect(isValidTopicString('astrology/houses')).toBe(false);
    expect(isValidTopicString('markets//x')).toBe(false);
    expect(STARTER_DOMAINS).toEqual(['markets', 'products', 'news', 'research', 'claims']);
  });
});

describe('vocabulary (Layer D)', () => {
  it('maps the five protocol verdicts with distinct tones', () => {
    expect(verdictHuman('agree').tone).toBe('aligned');
    expect(verdictHuman('disagree').tone).toBe('split');
    expect(verdictHuman('conflict').tone).toBe('contradiction');
    expect(verdictHuman('potential').tone).toBe('early-signal');
    expect(verdictHuman('insufficient-data').tone).toBe('insufficient');
    expect(verdictHuman('disagree').label).toBe('Sources split — gap detected');
    expect(Object.keys(VERDICT_VOCABULARY)).toHaveLength(5);
  });

  it('maps legacy v3 non-firing verdicts without throwing', () => {
    expect(verdictHuman('none').label).toBe('No signal');
    expect(verdictHuman('no-agreement').label).toBe('No signal');
    expect(verdictHuman('mystery-verdict').meaning).toContain('mystery-verdict');
  });

  it('frames splits by topic domain, defaulting to neutral', () => {
    expect(framingFor('markets', 'split')).toContain('opportunity');
    expect(framingFor('news', 'split')).toContain('more than one source');
    expect(framingFor('research', 'split')).toContain('live question');
    expect(framingFor(undefined, 'split')).toContain('live question');
    expect(DOMAIN_FRAMING.markets).toBe('opportunity');
  });

  it('carries the honesty rule in the score vocabulary', () => {
    expect(SCORE_PLAIN_MEANING.vScore).toContain('not whether the claim is true');
    expect(WHY_DIVERGENCE_WINS.body).toContain('Reading the gap is your edge');
  });

  it('builds master narratives in human vocabulary with explicit gaps', () => {
    const narrative = buildMasterNarrative({
      claimText: 'test claim',
      primaryVerdict: 'agree',
      sourcesTotal: 8,
      sourcesResponded: 7,
    });
    expect(narrative).toContain('Sources align: 7 of 8 sources');
    expect(narrative).toContain('recorded, not hidden');
    expect(narrative.length).toBeLessThanOrEqual(500);
  });
});
