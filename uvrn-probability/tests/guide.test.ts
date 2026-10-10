import { readFileSync } from 'fs';
import { join } from 'path';
import { runForecast, verifyForecastReceipt } from '../src';

const root = join(__dirname, '..');

describe('AGENT-GUIDE.md and package contents', () => {
  const guide = readFileSync(join(root, 'AGENT-GUIDE.md'), 'utf8');

  it('the guide example runs and produces the documented record', () => {
    const block = /## Example[\s\S]*?```json\n([\s\S]*?)```/.exec(guide);
    expect(block).not.toBeNull();
    const r = runForecast(JSON.parse(block![1]));
    expect(r).toMatchObject({
      status: 'forecast',
      basis: 'agent-judgment',
      band: null,
      probabilities: [
        { outcomeId: 'yes', p: 0.35 },
        { outcomeId: 'no', p: 0.65 },
      ],
      inputs: { judgment: { basisLabel: 'assumption-only' } },
    });
    expect(verifyForecastReceipt(r.receipt)).toMatchObject({ integrityOk: true, verified: false });
  });

  it('the guide covers off, on-demand, scoped on, missing evidence, and revised forecast', () => {
    for (const heading of ['**Off.**', '**On-demand.**', '**Scoped on.**', '**Missing evidence.**', '**Revised forecast.**']) {
      expect(guide).toContain(heading);
    }
  });

  it('the files allowlist ships the guide and never the planning folder', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'README.md', 'AGENT-GUIDE.md', 'LICENSE']));
    expect(pkg.files.some((f: string) => f.includes('planning'))).toBe(false);
    expect(Object.keys(pkg.exports)).toEqual(expect.arrayContaining(['.', './odds', './baserate', './judgment']));
    expect(pkg.peerDependencies).toEqual({ '@uvrn/receipt': '^5.1.0' });
    expect(pkg.dependencies).toBeUndefined();
  });
});
