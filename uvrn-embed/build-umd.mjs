import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';

await esbuild.build({
  entryPoints: ['src/umd.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'UVRN',
  outfile: 'dist/embed.umd.js',
  minify: true,
});

// Types for the "./umd" subpath: the IIFE bundle only assigns window.UVRN and has no module exports.
writeFileSync(
  'dist/embed.umd.d.ts',
  '// Browser script bundle: assigns window.UVRN ({ init, renderBadge }) and has no module exports.\nexport {};\n'
);
