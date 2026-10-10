#!/usr/bin/env node
/**
 * prepublishOnly guard: refuse to publish unless pnpm is the publisher.
 * pnpm rewrites `workspace:^` ranges to real versions at publish time; npm does not,
 * so an `npm publish` would ship a package that cannot be installed.
 */
const agent = process.env.npm_config_user_agent ?? '';
if (!agent.startsWith('pnpm/')) {
  console.error(
    'Refusing to publish: use `pnpm publish` from the package folder (see PUBLISH.md).\n' +
      'npm publish would ship unresolved `workspace:` dependency ranges.'
  );
  process.exit(1);
}
