import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DemoDataset, PackageFinding, ScenarioResult } from './types';

function findingLine(finding: PackageFinding): string {
  return `- ${finding.packageName}: ${finding.status}; standalone=${String(finding.standalone)}; peers=[${finding.peersRequired.join(', ')}]; ingress=${finding.ingressMode}. ${finding.notes}`;
}

function scenarioSection(scenario: ScenarioResult): string {
  const assertions = scenario.assertions
    .map((assertion) => `- ${assertion.passed ? 'PASS' : 'WARN'} ${assertion.label}: ${assertion.detail}`)
    .join('\n');

  return `## ${scenario.manifest.title}\n\n${scenario.summary}\n\n${assertions}\n`;
}

export async function writeArtifacts(workspaceRoot: string, dataset: DemoDataset): Promise<void> {
  const generatedDir = join(workspaceRoot, 'packages/scenarios/generated');
  const docsDir = join(workspaceRoot, 'docs');

  await mkdir(generatedDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  await writeFile(
    join(generatedDir, 'demo-dataset.json'),
    JSON.stringify(dataset, null, 2),
    'utf8'
  );
  await writeFile(
    join(generatedDir, 'findings.json'),
    JSON.stringify(dataset.findings, null, 2),
    'utf8'
  );
  await writeFile(
    join(generatedDir, 'scenarios.json'),
    JSON.stringify(dataset.scenarios, null, 2),
    'utf8'
  );

  const markdown = [
    '# UVRN Demo Findings',
    '',
    `Generated at: ${dataset.generatedAt}`,
    '',
    '## Package Findings',
    '',
    ...dataset.findings.map(findingLine),
    '',
    ...dataset.scenarios.map(scenarioSection),
  ].join('\n');

  await writeFile(join(docsDir, 'findings.md'), markdown, 'utf8');
}
