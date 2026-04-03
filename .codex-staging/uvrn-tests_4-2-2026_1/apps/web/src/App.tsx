import { useEffect, useState } from 'react';
import { ConsensusBadge } from '@uvrn/embed';

type ScenarioSummary = {
  id: string;
  title: string;
  summary: string;
  status: 'pass' | 'warn';
  packages: string[];
  assertions: Array<{ label: string; passed: boolean; detail: string }>;
};

type PackageFinding = {
  packageName: string;
  standalone: boolean;
  peersRequired: string[];
  combinations: string[];
  ingressMode: string;
  status: string;
  notes: string;
  evidence: string[];
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4174';
const EMBED_CLAIM_ID = 'clm_sol_momentum_001';

export function App(): JSX.Element {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [findings, setFindings] = useState<PackageFinding[]>([]);
  const [docs, setDocs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const [scenarioRes, findingsRes, docsRes] = await Promise.all([
          fetch(`${API_URL}/scenarios`),
          fetch(`${API_URL}/findings`),
          fetch(`${API_URL}/docs/findings`),
        ]);

        if (!scenarioRes.ok || !findingsRes.ok || !docsRes.ok) {
          throw new Error('Failed to load demo data from the local API.');
        }

        const [scenarioJson, findingsJson, docsJson] = await Promise.all([
          scenarioRes.json() as Promise<ScenarioSummary[]>,
          findingsRes.json() as Promise<PackageFinding[]>,
          docsRes.json() as Promise<{ markdown: string }>,
        ]);

        if (!cancelled) {
          setScenarios(scenarioJson);
          setFindings(findingsJson);
          setDocs(docsJson.markdown);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const verifiedCount = findings.filter((finding) => finding.status.startsWith('verified')).length;

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">UVRN Real-Test Demo</p>
          <h1>Protocol packages under live local pressure.</h1>
          <p className="lede">
            This dashboard runs the raw `uvrn-packages-next-2` packages through the local
            mock-ingest service, the demo API, and a scenario runner that writes findings back
            into the workspace. The default path stays zero-external, but the ingestion boundary
            is still real HTTP.
          </p>
          <div className="hero-stats">
            <div>
              <span>Scenarios</span>
              <strong>{scenarios.length || '0'}</strong>
            </div>
            <div>
              <span>Verified packages</span>
              <strong>{verifiedCount}</strong>
            </div>
            <div>
              <span>Embed route</span>
              <strong>/claims/:claimId/status</strong>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <p className="panel-label">Live UI Lab badge</p>
          <ConsensusBadge
            claimId={EMBED_CLAIM_ID}
            apiUrl={API_URL}
            theme="dark"
            showScore={true}
            showStatus={true}
          />
          <p className="panel-footnote">
            The badge is the actual `@uvrn/embed` component pointed at the local demo API.
          </p>
        </div>
      </section>

      {loading ? <section className="status-card">Loading demo dataset…</section> : null}
      {error ? <section className="status-card error">{error}</section> : null}

      <section className="grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Scenario Matrix</h2>
            <p>Each lab exercises a different package cluster and records assertions, logs, and notes.</p>
          </div>
          <div className="scenario-list">
            {scenarios.map((scenario) => (
              <article className={`scenario-card ${scenario.status}`} key={scenario.id}>
                <div className="scenario-header">
                  <div>
                    <h3>{scenario.title}</h3>
                    <p>{scenario.summary}</p>
                  </div>
                  <span className="scenario-badge">{scenario.status.toUpperCase()}</span>
                </div>
                <div className="chip-row">
                  {scenario.packages.map((item) => (
                    <span className="chip" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
                <ul className="assertion-list">
                  {scenario.assertions.map((assertion) => (
                    <li key={`${scenario.id}-${assertion.label}`}>
                      <strong>{assertion.passed ? 'PASS' : 'WARN'}</strong>
                      <span>{assertion.label}</span>
                      <small>{assertion.detail}</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="panel findings-panel">
          <div className="panel-heading">
            <h2>Package Findings</h2>
            <p>Standalone behavior, peer requirements, combination coverage, and ingestion mode.</p>
          </div>
          <div className="finding-table">
            {findings.map((finding) => (
              <article className="finding-row" key={finding.packageName}>
                <header>
                  <h3>{finding.packageName}</h3>
                  <span className="finding-status">{finding.status}</span>
                </header>
                <p>{finding.notes}</p>
                <div className="meta-grid">
                  <span>Standalone: {finding.standalone ? 'yes' : 'no'}</span>
                  <span>Ingress: {finding.ingressMode}</span>
                  <span>Peers: {finding.peersRequired.join(', ') || 'none'}</span>
                </div>
                <div className="chip-row">
                  {finding.combinations.map((item) => (
                    <span className="chip" key={`${finding.packageName}-${item}`}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="docs-layout">
        <div className="panel">
          <div className="panel-heading">
            <h2>Docs Snapshot</h2>
            <p>The scenario package writes markdown findings into the workspace on each generation run.</p>
          </div>
          <pre className="docs-preview">{docs}</pre>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Plain Embed Snippet</h2>
            <p>The same claim status route can power a simple external badge without React routing or extra glue.</p>
          </div>
          <pre className="code-block">{`<script src="/path/to/embed.umd.js"></script>
<div
  data-uvrn-claim="${EMBED_CLAIM_ID}"
  data-uvrn-api="${API_URL}"
  data-uvrn-theme="dark"
></div>`}</pre>
        </div>
      </section>
    </main>
  );
}
