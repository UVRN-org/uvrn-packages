import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAllScenarios, writeArtifacts } from '../src/index';

async function main(): Promise<void> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = resolve(currentDir, '../../..');
  const dataset = await runAllScenarios();
  await writeArtifacts(workspaceRoot, dataset);

  if (process.argv.includes('--smoke')) {
    const failed = dataset.scenarios.flatMap((scenario) =>
      scenario.assertions.filter((assertion) => !assertion.passed).map((assertion) => `${scenario.manifest.id}: ${assertion.label}`)
    );
    if (failed.length > 0) {
      throw new Error(`Smoke assertions failed: ${failed.join(', ')}`);
    }
  }

  process.stdout.write(`${JSON.stringify({ generatedAt: dataset.generatedAt, scenarios: dataset.scenarios.length }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
