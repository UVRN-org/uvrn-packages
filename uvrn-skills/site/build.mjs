#!/usr/bin/env node
// Builds the promo page from real example reports so the charts on the page are the real output.
//   node site/build.mjs [--repo URL]
// Writes site/artifact.html (fragment for the Artifact tool) and site/index.html (standalone page).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const repo = arg('--repo', 'https://github.com/UVRN-org/uvrn-packages/tree/main/uvrn-skills');
const svgs = (f) => readFileSync(path.join(here, '../examples/out', f + '.html'), 'utf8').match(/<svg[\s\S]*?<\/svg>/g);
const [vscore, evidence] = svgs('factcheck-brain'), [prob] = svgs('forecast-market'), [trend] = svgs('trend');
const tidy = (s) => s.replace(/(\d+\.\d{2})\d+/g, '$1');
let page = readFileSync(path.join(here, 'index.template.html'), 'utf8')
  .replaceAll('<!--SVG:vscore-->', tidy(vscore)).replaceAll('<!--SVG:evidence-->', tidy(evidence))
  .replaceAll('<!--SVG:prob-->', tidy(prob)).replaceAll('<!--SVG:trend-->', tidy(trend)).replaceAll('__REPO_URL__', repo);
writeFileSync(path.join(here, 'artifact.html'), page);
const title = page.match(/<title>.*?<\/title>/)[0];
const standalone = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${page.replace(title, '').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '')}`;
// standalone: move title into head, keep styles/link in head, body after </style>
const head = standalone.slice(0, standalone.indexOf('</style>') + 8) + `${title}</head><body>`;
const body = standalone.slice(standalone.indexOf('</style>') + 8);
writeFileSync(path.join(here, 'index.html'), `${head}${body}</body></html>\n`);
console.log('built site/artifact.html and site/index.html', page.length, 'bytes');
