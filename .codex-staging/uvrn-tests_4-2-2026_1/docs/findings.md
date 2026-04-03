# UVRN Demo Findings

Generated at: 2026-04-02T23:24:33.486Z

## Package Findings

- @uvrn/core: verified; standalone=true; peers=[]; ingress=direct. Core runs cleanly as the deterministic base for bundle validation, execution, and receipt verification.
- @uvrn/sdk: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. The SDK works well in local and HTTP modes and is easiest to validate against the same bundle fixture.
- @uvrn/cli: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. CLI smoke runs are straightforward once the package is built and the bundle is written to disk.
- @uvrn/api: verified-with-demo-glue; standalone=false; peers=[@uvrn/core]; ingress=direct. Official delta routes work as-is. The demo adds claim status and timeline routes because those are outside the current package surface.
- @uvrn/mcp: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. The MCP server is smoke-tested over stdio by listing tools and calling delta_run_engine against the shared bundle.
- @uvrn/adapter: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. Adapter wrapping works cleanly around core receipts with a local random wallet and no network requirements.
- @uvrn/drift: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. Drift snapshots and threshold events are easy to drive once mock-ingested evidence is converted into agent scores.
- @uvrn/agent: verified; standalone=false; peers=[@uvrn/drift]; ingress=provider-http. Agent integrations are strongest when farm data arrives through a real connector boundary rather than direct fixtures.
- @uvrn/canon: verified; standalone=false; peers=[@uvrn/core, @uvrn/drift]; ingress=direct. Manual canonization works well with mock signer and store implementations from @uvrn/test.
- @uvrn/signal: verified; standalone=true; peers=[]; ingress=local-callback. SignalBus is lightweight and easy to bridge from agent and watch events in-process.
- @uvrn/score: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. ScoreBreakdown is useful as the explanation layer for ingestion and lifecycle outputs.
- @uvrn/test: verified; standalone=false; peers=[@uvrn/core, @uvrn/drift, @uvrn/canon]; ingress=direct. The package is best used as a setup accelerator for demos, tests, and mock signer/store support.
- @uvrn/farm: verified-with-demo-glue; standalone=false; peers=[@uvrn/core, @uvrn/agent]; ingress=provider-http. Farm is the clearest place to test provider-style boundaries. Demo-owned connectors keep the default path zero-external.
- @uvrn/normalize: verified; standalone=false; peers=[@uvrn/core, @uvrn/agent]; ingress=direct. Normalization fits naturally between farm ingestion and consensus bundle construction.
- @uvrn/consensus: verified; standalone=false; peers=[@uvrn/core, @uvrn/agent]; ingress=direct. ConsensusEngine is effective once mock provider snippets carry usable numeric tokens.
- @uvrn/compare: verified; standalone=false; peers=[@uvrn/core, @uvrn/drift]; ingress=direct. CompareEngine works well on mixed receipt-like shapes and benefits from timeline-aligned data.
- @uvrn/identity: verified; standalone=false; peers=[@uvrn/core]; ingress=direct. IdentityRegistry is straightforward to demo with MockIdentityStore and recorded activities.
- @uvrn/timeline: verified-with-demo-glue; standalone=false; peers=[@uvrn/core, @uvrn/drift, @uvrn/canon]; ingress=direct. Timeline works locally with MockTimelineStore and can also target a remote API if a compatible route exists.
- @uvrn/watch: verified; standalone=false; peers=[@uvrn/agent, @uvrn/drift]; ingress=local-callback. The in-process callback path is the best default for demos. Third-party delivery targets stay optional.
- @uvrn/embed: verified-with-demo-glue; standalone=false; peers=[react, react-dom]; ingress=direct. Embed renders cleanly against a local claim status endpoint. The demo API provides the route expected by the package.

## Engine Lab

Engine package parity holds across direct, SDK, CLI, API, adapter, and MCP entrypoints.

- PASS Receipt parity: All engine receipts resolved to hash f4bb1f0cb1d00604358eb6d4f67c0c4bb2636a39006e635bbc2f121cc83f025f.
- PASS HTTP verify route: API verify reported true.
- PASS MCP tool surface: MCP tools: delta_run_engine, delta_validate_bundle, delta_verify_receipt.

## Ingestion Lab

Mock provider endpoints behave like real ingestion points and flow cleanly through farm, normalize, consensus, and score.

- PASS HTTP ingestion produced sources: Farm fetched 4 sources.
- PASS Normalization retained source count: Normalization returned 4 sources.
- PASS Consensus produced receipt: Consensus outcome was consensus.

## Lifecycle Lab

Lifecycle packages work together when the claim path is driven by HTTP-backed mock connectors and in-process stores.

- PASS Agent emitted receipts: Agent emitted 3 receipts.
- PASS Threshold transitions captured: Captured 2 threshold transitions.
- PASS Watch callback fired: Watch emitted 2 callback alerts.
- PASS Canon receipt persisted: Canon store contains 1 receipt.

## Analysis Lab

Analysis packages are strongest when fed by generated scenario history and mock stores rather than external systems.

- PASS Compare engine picked a winner: Delta was 47.1.
- PASS Series trend computed: Series trend resolved to declining.
- PASS Identity leaderboard returned entries: Leaderboard returned 2 signers.

## UI Lab

UI integration stays simple once the local demo API satisfies the embed package status contract.

- PASS Embed expects local status route: ConsensusBadge will target http://127.0.0.1:4174/claims/clm_sol_momentum_001/status.
- PASS Plain embed snippet available: The demo ships both React and plain HTML embed examples.
