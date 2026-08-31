/**
 * BP-06 — hygiene walls
 * (store-exercising adoption relocated to
 * @suttlemedia/store-d1-client/tests/adoption/timeline-store-adoption.test.ts).
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';


describe('BP-06 hygiene walls', () => {
  it('timeline + chart-memory sources stay free of d1/cloudflare/wrangler imports', () => {
    const packages = [
      join(__dirname, '..', '..', 'src'),
      join(__dirname, '..', '..', '..', 'uvrn-timeline', 'src'),
    ];

    for (const srcDir of packages) {
      const allFiles: string[] = [];
      for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          for (const f of readdirSync(join(srcDir, entry.name))) {
            if (f.endsWith('.ts')) allFiles.push(join(srcDir, entry.name, f));
          }
        } else if (entry.name.endsWith('.ts')) {
          allFiles.push(join(srcDir, entry.name));
        }
      }
      const joined = allFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
      const lower = joined.toLowerCase();
      // Wall 4 one-door / private-boundary: package src must not bind D1 or
      // import the worker-door client — tests outside src/ may still use mocks.
      expect(lower).not.toMatch(/from ['"]cloudflare/);
      expect(lower).not.toMatch(/@cloudflare/);
      expect(lower).not.toMatch(/wrangler/);
      expect(joined).not.toMatch(/\bD1Database\b/);
      expect(lower).not.toMatch(/@uvrn\/store-d1-client/);
      expect(lower).not.toMatch(/store-d1(?:-client)?/);
      expect(lower).not.toMatch(/(?:^|['"/@])d1(?:['"/]|$)/m);
      expect(lower).not.toMatch(/\bd1\b/);
    }
  });
});
