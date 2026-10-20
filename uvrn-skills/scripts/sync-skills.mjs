#!/usr/bin/env node
// lib/ + scripts/run.mjs are the single source of truth. Each skill folder gets its own copy so a skill
// installs and runs standalone (Claude Desktop skill upload, marketplace, copied folder). Never edit the copies.
//   node scripts/sync-skills.mjs          copy
//   node scripts/sync-skills.mjs --check  exit 1 if any copy is stale
import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = readdirSync(path.join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const pairs = [...readdirSync(path.join(root, 'lib')).map((f) => [`lib/${f}`, `lib/${f}`]), ['scripts/run.mjs', 'scripts/run.mjs'], ['NOTICE', 'NOTICE']];
const check = process.argv.includes('--check');
let stale = 0;
for (const s of skills) for (const [from, to] of pairs) {
  const src = path.join(root, from), dst = path.join(root, 'skills', s, to);
  if (check) { if (!existsSync(dst) || !readFileSync(src).equals(readFileSync(dst))) { console.error(`stale: skills/${s}/${to}`); stale++; } continue; }
  mkdirSync(path.dirname(dst), { recursive: true }); writeFileSync(dst, readFileSync(src)); // in-place write (no unlink/replace)
}
if (check) { if (stale) process.exit(1); console.log(`all ${skills.length} skills in sync`); } else console.log(`synced ${pairs.length} files into ${skills.length} skills`);
