import { canonicalize, formatReceiptHash } from '@uvrn/receipt/canonical';
import { sha256Hex } from '@uvrn/receipt';
import {
  FORECAST_VALIDATION_CODES,
  ForecastValidationError,
  LIMITATION_PROFILE,
  PROFILE_SPEC_VERSION,
  computeForecastHash,
  computeProfileHash,
  runForecast,
  verifyForecastReceipt,
  type ForecastInput,
  type ForecastProfile,
} from '../src';
import { fixtureProfile, judgmentAssumptionOnly, judgmentBinary, permitQuestion, vectorCasesV2 } from './fixtures-v2';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const byId = (id: string): ForecastInput => clone(vectorCasesV2().find((c) => c.id === id)!.input);
const withProfile = (id: string, overrides: Record<string, unknown> = {}): ForecastInput => ({
  ...byId(id),
  profile: fixtureProfile(overrides),
});

function expectError(input: unknown, code: string, path: string) {
  let caught: unknown;
  try {
    runForecast(input as ForecastInput);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ForecastValidationError);
  expect((caught as ForecastValidationError).code).toBe(code);
  expect((caught as ForecastValidationError).path).toBe(path);
}

describe('rule profiles (uvrn-probability-profile-1)', () => {
  it('declares the new validation codes', () => {
    expect(FORECAST_VALIDATION_CODES).toEqual(expect.arrayContaining(['invalid_profile', 'profile_violation']));
    expect(PROFILE_SPEC_VERSION).toBe('uvrn-probability-profile-1');
  });

  it('no profile leaves every vector without a profile member (existing hashes unchanged)', () => {
    for (const c of vectorCasesV2().filter((v) => !v.input.profile)) {
      expect('profile' in runForecast(c.input, c.options)).toBe(false);
    }
  });

  it('records { specVersion, id, version, hash } with hash = sha256(JCS(profile)), covered by probabilityHash', () => {
    const profile = fixtureProfile({ allowedModes: ['judgment'] });
    const r = runForecast({ ...byId('v2-judgment-binary'), profile });
    const expectedHash = formatReceiptHash(sha256Hex(canonicalize(profile as unknown as Record<string, unknown>)));
    expect(r.profile).toEqual({ specVersion: PROFILE_SPEC_VERSION, id: profile.id, version: profile.version, hash: expectedHash });
    expect(computeProfileHash(profile)).toBe(expectedHash);
    expect(r.limitations).toContain(LIMITATION_PROFILE);

    const plain = runForecast(byId('v2-judgment-binary'));
    expect(r.questionHash).toBe(plain.questionHash);
    expect(r.probabilityHash).not.toBe(plain.probabilityHash);
    expect(computeForecastHash(r as unknown as Record<string, unknown>)).toBe(r.probabilityHash);

    const other = runForecast({ ...byId('v2-judgment-binary'), profile: fixtureProfile({ allowedModes: ['judgment', 'market'] }) });
    expect(other.probabilityHash).not.toBe(r.probabilityHash);
  });

  it('tampering with, removing, or nulling the profile record breaks verification', () => {
    const r = runForecast({ ...byId('v2-judgment-binary'), profile: fixtureProfile() });
    expect(verifyForecastReceipt(r.receipt).probabilityHashOk).toBe(true);
    const tamper = (mutate: (p: Record<string, unknown>) => void) => {
      const receipt = clone(r.receipt);
      mutate(receipt.payload as Record<string, unknown>);
      return verifyForecastReceipt(receipt).probabilityHashOk;
    };
    expect(tamper((p) => ((p.profile as Record<string, unknown>).version = '2.0.0'))).toBe(false);
    expect(tamper((p) => delete p.profile)).toBe(false);
    const plain = runForecast(byId('v2-judgment-binary'));
    const nulled = clone(plain.receipt);
    (nulled.payload as Record<string, unknown>).profile = null;
    expect(verifyForecastReceipt(nulled).probabilityHashOk).toBe(false);
  });

  describe('tighten-only composition', () => {
    it('a higher minCases turns an accepted proportion into baserate_below_min_cases', () => {
      expect(runForecast(byId('v2-baserate-proportion')).status).toBe('forecast');
      const r = runForecast(withProfile('v2-baserate-proportion', { thresholds: { minCases: 10 } }));
      expect(r.status).toBe('insufficient_basis');
      expect(r.refusals.map((x) => x.code)).toEqual(['baserate_below_min_cases']);
      expect(r.inputs.thresholds).toEqual({
        provisional: true,
        values: expect.objectContaining({ minCases: 10 }),
        overridden: ['minCases'],
      });
    });

    it('the strictest of caller and profile wins; a caller loosening cannot undo a profile floor', () => {
      const accepted = byId('v2-baserate-at-risk-boundary-accepted');
      expect(accepted.thresholds).toEqual({ minCases: 6 });
      expect(runForecast(accepted).status).toBe('forecast');
      const r = runForecast({ ...accepted, profile: fixtureProfile({ thresholds: { minCases: 8 } }) });
      expect(r.inputs.thresholds?.values.minCases).toBe(8);
      expect(r.status).toBe('insufficient_basis');
      const callerStricter = runForecast({
        ...byId('v2-baserate-proportion'),
        thresholds: { minCases: 12 },
        profile: fixtureProfile({ thresholds: { minCases: 10 } }),
      });
      expect(callerStricter.inputs.thresholds?.values.minCases).toBe(12);
    });

    it('ceilings compose downward (exchange spread)', () => {
      const r = runForecast(withProfile('v2-market-exchange-settles-later', { thresholds: { maxExchangeSpread: 0.01 } }));
      expect(r.inputs.thresholds?.values.maxExchangeSpread).toBe(0.01);
      expect(r.refusals.map((x) => x.code)).toContain('market_spread_too_wide');
    });

    it.each([
      ['minCases', 7],
      ['maxQuoteStalenessMs', 86_400_001],
      ['maxExchangeSpread', 0.06],
      ['minExchangeDepthUsd', 999],
      ['maxSportsbookOverround', 0.51],
    ])('a profile %s that loosens the default fails with invalid_profile', (key, value) => {
      expectError(withProfile('v2-baserate-proportion', { thresholds: { [key]: value } }), 'invalid_profile', `profile.thresholds.${key}`);
    });

    it('profile thresholds are ignored in judgment mode (thresholds stay null)', () => {
      const r = runForecast(withProfile('v2-judgment-binary', { thresholds: { minCases: 20 } }));
      expect(r.inputs.thresholds).toBeNull();
      expect(r.status).toBe('forecast');
    });
  });

  describe('allowed modes', () => {
    it('a disallowed mode fails with profile_violation and no receipt', () => {
      expectError(withProfile('v2-market-sportsbook', { allowedModes: ['baserate', 'judgment'] }), 'profile_violation', 'mode');
      expectError(withProfile('v2-judgment-binary', { allowedModes: ['market'] }), 'profile_violation', 'mode');
    });

    it('an allowed mode proceeds unchanged apart from the profile record', () => {
      const plain = runForecast(byId('v2-market-sportsbook'));
      const r = runForecast(withProfile('v2-market-sportsbook', { allowedModes: ['market'] }));
      expect(r.probabilities).toEqual(plain.probabilities);
      expect(r.band).toEqual(plain.band);
    });

    it.each([
      [[], 'profile.allowedModes'],
      [['market', 'market'], 'profile.allowedModes[1]'],
      [['oracle'], 'profile.allowedModes[0]'],
    ])('malformed allowedModes %p fail with invalid_profile', (modes, path) => {
      expectError(withProfile('v2-judgment-binary', { allowedModes: modes }), 'invalid_profile', path);
    });
  });

  describe('requirements', () => {
    it('zonedTimestamps rejects date-only market and base-rate dates', () => {
      expectError(withProfile('v2-market-sportsbook', { require: { zonedTimestamps: true } }), 'profile_violation', 'market.resolvesAt');
      expectError(
        withProfile('v2-baserate-competing', { require: { zonedTimestamps: true } }),
        'profile_violation',
        'baserate.cases[0].filedAt'
      );
      const zoned = withProfile('v2-baserate-deadline-zoned', { require: { zonedTimestamps: true } });
      expect(runForecast(zoned).status).toBe('forecast');
    });

    it('judgmentRange requires a binary range; categorical judgments are unaffected', () => {
      const noRange = byId('v2-judgment-binary');
      const { range: _range, ...rest } = judgmentBinary();
      noRange.judgment = rest;
      expectError({ ...noRange, profile: fixtureProfile({ require: { judgmentRange: true } }) }, 'profile_violation', 'judgment.range');
      const categorical = withProfile('v2-judgment-categorical', { require: { judgmentRange: true } });
      expect(categorical.question).toEqual(permitQuestion());
      expect(runForecast(categorical).status).toBe('forecast');
    });

    it('citedEvidence rejects assumption-only judgments; abstention is still allowed', () => {
      const a = byId('v2-judgment-binary');
      a.judgment = judgmentAssumptionOnly();
      expectError({ ...a, profile: fixtureProfile({ require: { citedEvidence: true } }) }, 'profile_violation', 'judgment.evidence');
      const abstain = withProfile('v2-judgment-abstain', { require: { citedEvidence: true, judgmentRange: true } });
      expect(runForecast(abstain).status).toBe('insufficient_basis');
    });

    it('false requirements are no-ops but are part of the profile hash', () => {
      const r = runForecast(withProfile('v2-market-sportsbook', { require: { zonedTimestamps: false } }));
      expect(r.status).toBe('forecast');
      expect(r.profile?.hash).not.toBe(computeProfileHash(fixtureProfile() as ForecastProfile));
    });
  });

  describe('strict structure', () => {
    it.each([
      [{ callback: 'x' }, 'unknown_field', 'profile.callback'],
      [{ thresholds: { minCases: 9, extra: 1 } }, 'unknown_field', 'profile.thresholds.extra'],
      [{ require: { anything: true } }, 'unknown_field', 'profile.require.anything'],
      [{ require: { citedEvidence: 'yes' } }, 'invalid_profile', 'profile.require.citedEvidence'],
      [{ id: ' ' }, 'invalid_profile', 'profile.id'],
      [{ version: 3 }, 'invalid_profile', 'profile.version'],
      [{ thresholds: { minCases: 9.5 } }, 'invalid_profile', 'profile.thresholds.minCases'],
      [{ thresholds: { maxExchangeSpread: Number.NaN } }, 'invalid_profile', 'profile.thresholds.maxExchangeSpread'],
      [{ specVersion: 'uvrn-probability-profile-2' }, 'unsupported_version', 'profile.specVersion'],
    ])('%p fails with %s at %s', (overrides, code, path) => {
      expectError(withProfile('v2-judgment-binary', overrides), code, path);
    });

    it('a non-object profile fails and messages never echo profile values', () => {
      expectError({ ...byId('v2-judgment-binary'), profile: 'strict' }, 'invalid_profile', 'profile');
      try {
        runForecast(withProfile('v2-judgment-binary', { id: 'secret-profile-id', allowedModes: ['market'] }));
      } catch (e) {
        expect((e as Error).message).not.toContain('secret-profile-id');
      }
    });
  });
});
