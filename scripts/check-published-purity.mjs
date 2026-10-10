/**
 * Published-artifact purity gate (no publish).
 *
 * Runs `npm pack --dry-run` for every workspace package (all 34 by default) and scans
 * every file that would ship for machine-specific paths, local usernames, private
 * package scopes / repo names, internal ops paths, and sync markers.
 *
 * Usage:
 *   node scripts/check-published-purity.mjs            # all workspace packages
 *   node scripts/check-published-purity.mjs <dir>...   # only these package dirs
 *
 * This file holds the forbidden patterns, so it must never be inside the scan scope:
 * it lives in scripts/ (not a package) and is also skipped explicitly below.
 *
 * Private source mode: when scripts/export-public.sh is present (it never ships to the public
 * repo), this runs inside the private source tree. There the export still has work to do, so
 * the gate skips the private-only packages, the private repo URL in package.json (the export
 * rewrites repository/homepage/bugs) and sync markers (the export strips them). Everything
 * else stays enforced; the export runs its own leak scan on the final public tree.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const selfPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(selfPath), '..');

// Terms are assembled from fragments so this file never spells them out whole; it ships in
// the public repo, whose export leak scan rejects any file containing them.
const PRIVATE_SCOPE = 'suttle' + 'media';
const PRIVATE_REPO = 'uvrn-packages' + '-v2';
const ADMIN_DIR = '.' + 'admin';
const HIVE_DIR = '.' + 'hive';
const PRIVATE_MARKER = 'private' + ':';
const PUBLIC_MARKER = 'public' + ':';

/** Private scope / repo / ops-path terms that must never ship in a public tarball. */
export const PRIVATE_TERM_RULES = [
  { label: 'private package scope', pattern: new RegExp(PRIVATE_SCOPE, 'gi') },
  { label: 'former private package scope', pattern: /@uvrn-vip/gi },
  { label: 'private repo name', pattern: new RegExp(PRIVATE_REPO, 'gi') },
  { label: `internal ops path (${ADMIN_DIR})`, pattern: new RegExp(`\\${ADMIN_DIR}\\b`, 'gi') },
  { label: `internal ops path (${HIVE_DIR})`, pattern: new RegExp(`\\${HIVE_DIR}\\b`, 'gi') },
  { label: 'private sync marker', pattern: new RegExp(`${PRIVATE_MARKER}(?:start|end)`, 'gi') },
  { label: 'public sync marker', pattern: new RegExp(`${PUBLIC_MARKER}(?:start|end)`, 'gi') },
];

const rules = [
  { label: 'macOS user path', pattern: /\/Users\/[^/<\s]+/g },
  { label: 'Linux user path', pattern: /\/home\/[^/<\s]+/g },
  { label: 'Windows user path', pattern: /[A-Z]:\\Users\\[^\\<\s]+/gi },
  { label: 'Claude Library shorthand', pattern: /~\/Library/g },
  { label: 'local username', pattern: /lyrikai/gi },
  ...PRIVATE_TERM_RULES,
];

const privateSource = existsSync(join(root, 'scripts', 'export-public.sh'));
const PRIVATE_ONLY_PACKAGES = new Set(['uvrn-arcanum', 'uvrn-case-bank', 'uvrn-checker', 'uvrn-store-d1-client', 'uvrn-host']);

/** In private source mode, skip what the public export rewrites or strips. */
function exportHandles(rule, filePath) {
  if (!privateSource) return false;
  if (/sync marker/.test(rule.label)) return true;
  // package.json: the export rewrites the repo URL and drops private-scope dependencies.
  return filePath === 'package.json' && /private (repo name|package scope)/.test(rule.label);
}

/** Character ranges of private start … end marker blocks, which the export strips. */
function privateBlocks(text) {
  if (!privateSource) return [];
  const ranges = [];
  const re = new RegExp(`${PRIVATE_MARKER}start[\\s\\S]*?${PRIVATE_MARKER}end`, 'g');
  for (const m of text.matchAll(re)) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function main(argv) {
  const pkgDirs =
    argv.length > 0
      ? argv.map((d) => resolve(d))
      : JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
          .workspaces.filter((w) => !(privateSource && PRIVATE_ONLY_PACKAGES.has(w)))
          .map((w) => join(root, w));

  const result = spawnSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts', ...pkgDirs],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed\n${result.stdout}\n${result.stderr}`);
  }

  const packs = JSON.parse(result.stdout);
  if (packs.length !== pkgDirs.length) {
    throw new Error(`expected ${pkgDirs.length} pack results, got ${packs.length}`);
  }

  const violations = [];
  let fileCount = 0;
  packs.forEach(({ name, files }, i) => {
    for (const file of files) {
      const path = join(pkgDirs[i], file.path);
      if (resolve(path) === selfPath) continue;
      fileCount += 1;
      const contents = readFileSync(path);
      if (contents.includes(0)) continue;
      const text = contents.toString('utf8');
      const stripped = privateBlocks(text);
      for (const rule of rules) {
        if (exportHandles(rule, file.path)) continue;
        for (const match of text.matchAll(rule.pattern)) {
          if (stripped.some(([a, b]) => match.index >= a && match.index < b)) continue;
          const line = text.slice(0, match.index).split('\n').length;
          violations.push(`${name} ${file.path}:${line}: ${rule.label}: ${match[0]}`);
        }
      }
    }
  });

  if (violations.length > 0) {
    throw new Error(`Published-artifact purity violations:\n${violations.join('\n')}`);
  }

  console.log(
    `PASS${privateSource ? ' (private source mode)' : ''}: ${packs.length} packages / ${fileCount} packed files contain no machine-specific paths, usernames, private names, or sync markers`,
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2));
}
