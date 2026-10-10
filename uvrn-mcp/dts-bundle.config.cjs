// Bundles the public type surface into one self-contained dist/index.d.ts.
// The @uvrn/* runtime is bundled into dist/index.js (esbuild.config.mjs), so its types are inlined
// here too: a solo `npm install @uvrn/mcp` must type-check without any @uvrn/* package installed.
const fs = require('node:fs');
const path = require('node:path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const uvrnLibraries = Object.keys(pkg.devDependencies).filter((name) => name.startsWith('@uvrn/'));

module.exports = {
  compilationOptions: {
    preferredConfigPath: path.join(__dirname, 'tsconfig.json'),
  },
  entries: [
    {
      filePath: path.join(__dirname, 'src/index.ts'),
      outFile: path.join(__dirname, 'dist/index.d.ts'),
      noCheck: true,
      libraries: {
        inlinedLibraries: uvrnLibraries,
      },
      output: {
        noBanner: true,
        // Inlined @uvrn/* types stay module-local; the public exports are those of src/index.ts.
        exportReferencedTypes: false,
      },
    },
  ],
};
