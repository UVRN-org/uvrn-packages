module.exports = {
  extends: ['../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  },
  rules: {
    // CLI entrypoint — console output is intentional user-facing I/O
    'no-console': 'off'
  }
};
