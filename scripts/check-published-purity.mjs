import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('npm', ['pack', './uvrn-mcp', '--dry-run', '--json'], {
  cwd: root,
  encoding: 'utf8',
});

if (result.status !== 0) {
  throw new Error(`npm pack --dry-run failed\n${result.stdout}\n${result.stderr}`);
}

const [{ files }] = JSON.parse(result.stdout);
const rules = [
  { label: 'macOS user path', pattern: /\/Users\/[^/<\s]+/g },
  { label: 'Linux user path', pattern: /\/home\/[^/<\s]+/g },
  { label: 'Windows user path', pattern: /[A-Z]:\\Users\\[^\\<\s]+/gi },
  { label: 'Claude Library shorthand', pattern: /~\/Library/g },
  { label: 'local username', pattern: /lyrikai/gi },
];
const violations = [];

for (const file of files) {
  const path = join(root, 'uvrn-mcp', file.path.replace(/^package\//, ''));
  const contents = readFileSync(path);
  if (contents.includes(0)) continue;
  const text = contents.toString('utf8');
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      violations.push(`${file.path}: ${rule.label}: ${match[0]}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Published-artifact purity violations:\n${violations.join('\n')}`);
}

console.log(`PASS: ${files.length} packed files contain no machine-specific paths or usernames`);
