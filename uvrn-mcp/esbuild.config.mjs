import { build } from 'esbuild';

// The server is self-contained: every @uvrn/* runtime is bundled into dist/index.js, EXCEPT the
// optional peer @uvrn/probability. It stays external so delta_prob_run loads the host-installed
// package lazily (and reports a clean optional-peer error when it is absent).
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
  legalComments: 'external',
  external: ['@modelcontextprotocol/sdk/*', '@uvrn/probability', '@uvrn/probability/*'],
});
