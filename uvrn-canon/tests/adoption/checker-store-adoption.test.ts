/**
 * BP-07 — hygiene walls (checker package not in public export).
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('BP-07 hygiene walls', () => {
  it('canon sources stay free of d1/cloudflare/wrangler imports', () => {
    const packages = [join(__dirname, '..', '..', 'src')];
    const checkerSrc = join(__dirname, '..', '..', '..', 'uvrn-checker', 'src');
    if (existsSync(checkerSrc)) packages.push(checkerSrc);

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
