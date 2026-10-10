import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runProbability } from '../src';
import { vectorCases } from './fixtures';

const SCHEMAS = join(__dirname, '..', '..', 'SPEC', 'schemas');
const load = (name: string) => JSON.parse(readFileSync(join(SCHEMAS, name), 'utf8'));

describe('SPEC/schemas', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateInput = ajv.compile(load('uvrn-probability-input-1.schema.json'));
  const validateResult = ajv.compile(load('uvrn-probability-result-1.schema.json'));

  it.each(vectorCases().map((c) => [c.id, c] as const))('%s: input and result conform', (_id, c) => {
    expect(validateInput(c.input) ? null : validateInput.errors).toBeNull();
    const result = JSON.parse(JSON.stringify(runProbability(c.input, c.options)));
    expect(validateResult(result) ? null : validateResult.errors).toBeNull();
  });

  it('rejects an asOf without a timezone', () => {
    const input = { ...vectorCases()[0].input, asOf: { at: '2026-09-26T12:00:00', source: vectorCases()[0].input.asOf.source } };
    expect(validateInput(input)).toBe(false);
  });
});
