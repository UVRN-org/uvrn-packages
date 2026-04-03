export interface ScenarioManifest {
  id: string;
  title: string;
  summary: string;
  packages: string[];
  mode: 'engine' | 'ingestion' | 'lifecycle' | 'analysis' | 'ui';
}

export interface PackageFinding {
  packageName: string;
  standalone: boolean;
  peersRequired: string[];
  combinations: string[];
  ingressMode: 'none' | 'direct' | 'provider-http' | 'local-callback';
  status: 'verified' | 'verified-with-demo-glue' | 'indirect' | 'docs-only';
  notes: string;
  evidence: string[];
}

export interface MockProviderScenario {
  claimId: string;
  provider: string;
  variant: string;
  responseShape: 'search' | 'assets' | 'articles' | 'timeline';
  latencyMs: number;
}

export interface ScenarioAssertion {
  label: string;
  passed: boolean;
  detail: string;
}

export interface ScenarioResult {
  manifest: ScenarioManifest;
  summary: string;
  status: 'pass' | 'warn';
  assertions: ScenarioAssertion[];
  outputs: Record<string, unknown>;
  logs: string[];
  findings: string[];
}

export interface DemoDataset {
  generatedAt: string;
  manifests: ScenarioManifest[];
  scenarios: ScenarioResult[];
  findings: PackageFinding[];
}
