/** Used by Jest to transform ESM @noble packages to CJS. */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]
  ]
};
