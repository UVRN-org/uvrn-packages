import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runForecast } from '../src';
import { parseOffsetMinutes } from '../src/common/strict';
import { vectorCasesV2 } from './fixtures-v2';
import { judgmentV3, validationErrorCasesV3, vectorCasesV3 } from './fixtures-v3';

const SCHEMAS = join(__dirname, '..', '..', 'SPEC', 'schemas');
const load = (name: string) => JSON.parse(readFileSync(join(SCHEMAS, name), 'utf8'));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('SPEC/schemas (version 3)', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const inputSchema = load('uvrn-probability-input-3.schema.json');
  const validateInput = ajv.compile(inputSchema);
  const validateResult = ajv.compile(load('uvrn-probability-result-3.schema.json'));

  it.each(vectorCasesV3().map((c) => [c.id, c] as const))('%s: input and result conform', (_id, c) => {
    expect(validateInput(c.input) ? null : validateInput.errors).toBeNull();
    const result = JSON.parse(JSON.stringify(runForecast(c.input, c.options)));
    expect(validateResult(result) ? null : validateResult.errors).toBeNull();
  });

  it('the offset pattern agrees with parseOffsetMinutes on every ±HH:MM (HH, MM 00–99)', () => {
    const pattern = new RegExp(inputSchema.$defs.utcOffset.pattern, 'u');
    const disagreements: string[] = [];
    let accepted = 0;
    for (const sign of ['+', '-']) {
      for (let h = 0; h < 100; h += 1) {
        for (let m = 0; m < 100; m += 1) {
          const s = `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const bySchema = pattern.test(s);
          const byCode = parseOffsetMinutes(s) !== null;
          if (bySchema) accepted += 1;
          if (bySchema !== byCode) disagreements.push(s);
        }
      }
    }
    expect(disagreements).toEqual([]);
    // +00:00 … +14:00 is 14*60 + 1 values; -00:01 … -12:00 is 12*60 values.
    expect(accepted).toBe(14 * 60 + 1 + 12 * 60);
  });

  it('the offset pattern rejects malformed strings the code rejects', () => {
    const pattern = new RegExp(inputSchema.$defs.utcOffset.pattern, 'u');
    for (const bad of ['-00:00', '+5:00', '+0500', '05:00', 'Z', ' +05:00', '+05:00 ', '+０５:００', '']) {
      expect(pattern.test(bad)).toBe(false);
      expect(parseOffsetMinutes(bad)).toBeNull();
    }
  });

  it('rejects the structural failures the implementation rejects', () => {
    const j = () => clone(judgmentV3('fx3-schema', '-04:00'));
    const missing = j();
    delete (missing.question as unknown as Record<string, unknown>).resolveByOffset;
    expect(validateInput(missing)).toBe(false);
    for (const offset of ['-00:00', '-12:01', '+14:01', '+24:00']) {
      const bad = j();
      bad.question.resolveByOffset = offset;
      expect(validateInput(bad)).toBe(false);
    }
    expect(validateInput({ ...j(), specVersion: 'uvrn-probability-input-2' })).toBe(false);
    expect(validateInput({ ...j(), extra: 1 })).toBe(false);
  });

  it('a version-2 input does not conform to the version-3 input schema', () => {
    expect(validateInput(vectorCasesV2()[0].input)).toBe(false);
  });

  it('validation-error cases the schema can see are rejected; range/asOf rules are left to runForecast', () => {
    for (const c of validationErrorCasesV3()) {
      const schemaVisible = c.error.path === 'question.resolveByOffset';
      expect([c.id, validateInput(c.input)]).toEqual([c.id, !schemaVisible]);
    }
  });
});
