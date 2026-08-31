/**
 * BP-10 — hygiene walls
 * (store-exercising adoption relocated to
 * @suttlemedia/store-d1-client/tests/adoption/watch-store-adoption.test.ts).
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';


describe('BP-10 hygiene walls', () => {
  it('@uvrn/watch src stays free of d1/cloudflare/wrangler imports', () => {
    const srcDir = join(__dirname, '..', '..', 'src');
    const allFiles: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) allFiles.push(full);
      }
    }
    walk(srcDir);

    const joined = allFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    const lower = joined.toLowerCase();
    expect(lower).not.toMatch(/from ['"]cloudflare/);
    expect(lower).not.toMatch(/@cloudflare/);
    expect(lower).not.toMatch(/wrangler/);
    expect(joined).not.toMatch(/\bD1Database\b/);
    expect(lower).not.toMatch(/@uvrn\/store-d1-client/);
    expect(lower).not.toMatch(/\bd1\b/);
  });
});
