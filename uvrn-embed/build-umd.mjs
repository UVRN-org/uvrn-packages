import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/umd.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'UVRN',
  outfile: 'dist/embed.umd.js',
  minify: true,
});
