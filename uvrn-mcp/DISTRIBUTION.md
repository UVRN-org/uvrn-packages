# Distribution validation record

**Unit:** BP-07 / WS-DISTRO-001  
**Date:** 2026-07-19  
**Status:** publish-ready; not published (program D3)

## Measured baseline

Before changing the build, `npx -y @uvrn/mcp@4.0.1` was run from a new temporary directory with an
isolated empty npm cache using Node 25.8.1 and npm 11.11.0. It started successfully and returned the
exact nine tools. npm made that work by auto-installing all eleven declared `@uvrn/*` peers beside
`@uvrn/mcp`; the launch therefore worked, but was coupled to npm's peer-install behavior and the
availability of the entire peer closure.

Docker was unavailable on the build host, so this pre-change measurement used an isolated
directory/cache rather than a local container. The committed CI job repeats the packed-artifact
test on a clean Ubuntu runner.

## WS-DISTRO D1 decision

**Selected: bundle the `@uvrn/*` runtime.** esbuild produces one CommonJS Node entry containing the
UVRN runtime. The MCP SDK remains a normal dependency. UVRN packages remain declared as optional
peers for source/type compatibility, preserving the peer-hygiene rule while preventing npm from
installing them for the CLI path.

This is additive distribution work: no hash/sign implementation or tool behavior changed
(ADR-010). Because `@uvrn/receipt` is embedded, CI runs its ADR-006 canonicalization vectors and
then verifies a signed fixture receipt produced by the bundled artifact with the workspace receipt
implementation.

The public mirror decision (D2 in the archived distribution design) remains parked. npm remains
the program's selected release channel, and no publish occurs in this unit (program D3/D12).

## Packed-artifact result

`pnpm test:mcp-tarball`:

- packs `uvrn-mcp` and installs it in a clean temporary consumer;
- proves `@uvrn/mcp` is the only installed package under the `@uvrn` scope;
- asserts the exact nine-tool MCP handshake against `plugin-manifest.json`;
- executes fixture-only `delta_score_claim`; and
- verifies the bundled signed NetworkReceipt.

The same validator was deliberately run with an expected count of ten and exited non-zero, proving
the CI smoke turns red when the handshake contract is wrong.

## Connector validation

| Connector | Validation performed | Result |
|---|---|---|
| Claude Desktop | JSON profile parsed; zero-config npx launch matched; published npx baseline completed a nine-tool handshake | PASS (profile + client-free protocol); Desktop app not modified or launched |
| Claude Code | `.mcp.json` parsed; relative local-build launch matched; bundled local entry completed the same protocol path | PASS (profile + client-free protocol); Claude Code app not launched |
| Hermes | YAML structure, npx args, server key, and tool-prefix guidance checked | PASS lint; Hermes client not available/run |
| Odysseus | documented npx command, args, local-build form, and nine-tool claim checked | PASS lint; Odysseus client not available/run |

No machine-specific client configuration was written. All execution stayed fixture-only under
program D13 local-safe rules.
