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
 * Private names (package scope, repo name, local username) are held only as SHA-256 fingerprints,
 * so this public file never names them. Generic patterns (paths, sync markers) stay as regexes.
 * The file lives in scripts/ (not a package) and is also skipped explicitly below.
 *
 * Private source mode: when scripts/export-public.sh is present (it never ships to the public
 * repo), this runs inside the private source tree. There the export still has work to do, so
 * the gate skips the private-only packages, the private repo URL in package.json (the export
 * rewrites repository/homepage/bugs) and sync markers (the export strips them). Everything
 * else stays enforced; the export runs its own leak scan on the final public tree.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const selfPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(selfPath), '..');

// Generic ops/marker terms are assembled from fragments so the export leak scan does not flag
// this file. Private names are not here at all: see PRIVATE_NAME_FINGERPRINTS.
const ADMIN_DIR = '.' + 'admin';
const HIVE_DIR = '.' + 'hive';
const PRIVATE_MARKER = 'private' + ':';
const PUBLIC_MARKER = 'public' + ':';

/**
 * Private names that must never ship, as fingerprints of the lowercased term: length, a 32-bit
 * FNV-1a prefilter, and SHA-256. Matching is case-insensitive and substring-based within runs of
 * [a-z0-9-], like the regexes it replaces. Reports never echo the matched text.
 */
export const PRIVATE_NAME_FINGERPRINTS = [
  { label: 'private package scope', len: 11, fnv: 618037690, sha256: '6ad29d16986098d2d80b01ac5066ac724b32036c0f6501fa2c1853dac99d12c6' },
  { label: 'former private package scope', len: 8, fnv: 3632436624, sha256: '4dfbf0ba79d43bd4019da152186fa3e1be514a82c174cc0c3dc3427abfccac88' },
  { label: 'private repo name', len: 16, fnv: 2500705835, sha256: '2a4c3c35b2fc005dd8ee8f5f5891004b338f04db9589ac2d94de43cc6460c568' },
  { label: 'local username', len: 7, fnv: 476935690, sha256: '6f596395d5ef8e7cc9c06c2dc3a43c4c233ea9b230f742b45df36e78fb387520' },
];

const isNameChar = (c) => (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45; // a-z 0-9 -

/** All fingerprinted private names in `text`: [{ label, index }] (index into `text`). */
export function findPrivateNames(text) {
  const lower = text.toLowerCase();
  const byLen = new Map();
  for (const f of PRIVATE_NAME_FINGERPRINTS) byLen.set(f.len, [...(byLen.get(f.len) ?? []), f]);
  const hits = [];
  let i = 0;
  while (i < lower.length) {
    if (!isNameChar(lower.charCodeAt(i))) { i += 1; continue; }
    let end = i;
    while (end < lower.length && isNameChar(lower.charCodeAt(end))) end += 1;
    for (const [len, fps] of byLen) {
      for (let s = i; s + len <= end; s += 1) {
        let h = 0x811c9dc5;
        for (let k = s; k < s + len; k += 1) h = Math.imul(h ^ lower.charCodeAt(k), 0x01000193) >>> 0;
        const cands = fps.filter((f) => f.fnv === h);
        if (cands.length === 0) continue;
        const digest = createHash('sha256').update(lower.slice(s, s + len)).digest('hex');
        for (const f of cands) if (f.sha256 === digest) hits.push({ label: f.label, index: s });
      }
    }
    i = end;
  }
  return hits;
}

/** Generic ops-path / sync-marker patterns that must never ship in a public tarball. */
export const PRIVATE_TERM_RULES = [
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
      const lineOf = (index) => text.slice(0, index).split('\n').length;
      for (const rule of rules) {
        if (exportHandles(rule, file.path)) continue;
        for (const match of text.matchAll(rule.pattern)) {
          if (stripped.some(([a, b]) => match.index >= a && match.index < b)) continue;
          violations.push(`${name} ${file.path}:${lineOf(match.index)}: ${rule.label}: ${match[0]}`);
        }
      }
      for (const hit of findPrivateNames(text)) {
        if (exportHandles(hit, file.path)) continue;
        if (stripped.some(([a, b]) => hit.index >= a && hit.index < b)) continue;
        violations.push(`${name} ${file.path}:${lineOf(hit.index)}: ${hit.label} (name not shown)`);
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
