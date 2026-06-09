# Post-Merge Connector Validation Report
# feat/trend-engine-layer-v1 — MCP Connector Layer (PR #3)

**Date:** 2026-06-08
**Branch:** `feat/trend-engine-layer-v1`
**Remote:** up to date with `origin/feat/trend-engine-layer-v1`
**Build:** `@uvrn/mcp` v1.2.0 (local, 13-package filter build)
**Session:** Claude Code — this session's `mcp__uvrn__*` tools used for live functional calls

---

## Verdict

**PASS WITH CONDITIONS** — the connector layer is structurally sound and functionally
operational via Claude Code (`.mcp.json`). The local build path works end-to-end. Three
issues must be resolved before this branch advances to publish or PR to main:

| # | Issue | Severity | Path |
|---|---|---|---|
| F1 | `MasterReceipt` missing `v_score` / `claimId` — breaks `delta_compare` chaining | Major | Human + code fix |
| D1 | All connector profiles + CONNECT.md smoke example use `npx` — tests wrong version pre-publish | Decision | Human must decide |
| D2 | Claude Desktop `mcpServers.uvrn` entry absent from local config — Test 3 blocked | Blocked | Human re-applies patch |

---

## Pre-flight

| Check | Result |
|---|---|
| Branch `feat/trend-engine-layer-v1` checked out | ✓ Already on branch |
| `git pull origin feat/trend-engine-layer-v1` | ✓ Already up to date |
| `.mcp.json` present | ✓ 164 bytes, Jun 8 |
| `uvrn-mcp/CONNECT.md` present | ✓ 4653 bytes, Jun 8 |
| `uvrn-mcp/plugin-manifest.json` present | ✓ 1155 bytes |
| `uvrn-mcp/connectors/claude-desktop.json` | ✓ |
| `uvrn-mcp/connectors/hermes.config.yaml` | ✓ |
| `uvrn-mcp/connectors/odysseus.md` | ✓ |
| Build (13-package filter) | ✓ All clean, no errors |

**Pre-flight: PASS**

---

## Test 1 — Client-free smoke (stdio handshake)

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node uvrn-mcp/dist/index.js
```

| Check | Result |
|---|---|
| `serverInfo.name` | `"delta-engine-mcp"` ✓ |
| `serverInfo.version` | `"1.2.0"` ✓ |
| Tool count | 9 ✓ |
| stderr errors | None (INFO logs only) ✓ |

**Tool names returned (all 9 match plugin-manifest.json):**
`delta_run_engine`, `delta_validate_bundle`, `delta_verify_receipt`, `delta_score_drift`,
`delta_compare`, `delta_verify_identity`, `delta_canon_qualify`, `delta_canon_get`,
`delta_score_claim`

**Documentation gap (D1):** The CONNECT.md "Verify the connection" smoke command (line 99)
uses `npx -y @uvrn/mcp`. That fetches the published package (v1.5.4 / @uvrn/core 1.6.1),
not this branch (v1.2.0). The smoke command should note local-build form as the pre-publish
option, or carry a NOTE that the npx form requires a publish of this branch first.

**Test 1: PASS**

---

## Test 2 — Claude Code (this session)

`mcp__uvrn__*` tools appeared in the deferred tool list for this session, confirming the
`.mcp.json` `uvrn` server connected at session start. All 9 tools were loaded via
`ToolSearch` and called successfully (see Tests 6a / 6b below).

**Config:** `.mcp.json` → `"command": "node"`, `"args": ["uvrn-mcp/dist/index.js"]`
(relative path, correct local-build form, pure-product compliant).

**Test 2: PASS**

---

## Test 3 — Claude Desktop

### 3a — Connection verification

**BLOCKED.** `~/Library/Application Support/Claude/claude_desktop_config.json` does NOT
contain a `mcpServers` key. The entry added in the prior session is absent — most likely
wiped by a Claude Desktop update or config reset.

Expected (per prior session memory):
```json
{
  "mcpServers": {
    "uvrn": {
      "command": "node",
      "args": ["/abs/path/to/uvrn-mcp/dist/index.js"]
    }
  }
}
```

Actual: the file contains only `coworkUserFilesPath` and `preferences` — no `mcpServers`.

**Action required (human):** Re-add the `mcpServers.uvrn` block to
`~/Library/Application Support/Claude/claude_desktop_config.json`, pointing `args` to the
absolute local-build path. Use `node` command (not `npx`) to test this branch. Fully quit
and relaunch Claude Desktop after editing.

**Reference connector file** (`uvrn-mcp/connectors/claude-desktop.json`) uses the npx form
by design — do not copy it directly for local-build testing (D1 gap).

### 3b — POD trend research functional test

**BLOCKED** — depends on 3a.

**Test 3: BLOCKED**

---

## Test 4 — Hermes

**DEFERRED** (per plan). `uvrn-mcp/connectors/hermes.config.yaml` is present and correct.
When this session runs: swap the npx command for the local-build form.

**Test 4: SKIP**

---

## Test 5 — Odysseus

**PENDING INSTALL** (per plan). `uvrn-mcp/connectors/odysseus.md` is present.
**Note:** `odysseus.md` already documents a "Local-build variant" section with an
`<ABSOLUTE_PATH_TO_REPO>` placeholder — best of the three connector profiles for
pre-publish local testing.

**Test 5: SKIP**

---

## Test 6 — Functional calls (this Claude Code session)

### 6a — `delta_validate_bundle`

Input: bundle `smoke-test-001`, 2 sources, `thresholdPct: 0.05`, Q1 revenue claim.

```json
{ "valid": true, "details": "Bundle \"smoke-test-001\" is valid with 2 data specs" }
```

**Test 6a: PASS**

---

### 6b — `delta_score_claim`

Input: `"Bitcoin is a widely used digital currency"`, `claimId: "smoke-score-001"`

```json
{
  "masterReceipt": {
    "envelopeVersion": 1,
    "claim": "Bitcoin is a widely used digital currency",
    "base": {
      "bundleId": "consensus-2a97a292",
      "deltaFinal": 0.01980198,
      "sources": ["Mock Source A", "Mock Source B"],
      "rounds": [{ "round": 1, "deltasByMetric": { "consensus_value": 0.01980198 }, "withinThreshold": true, "witnessRequired": false }],
      "suggestedFixes": [],
      "outcome": "consensus",
      "hash": "b457b1baf2dbe1ba6f6fe95a4819d586852f258791bc365e66a9de9b0b8feaa0"
    },
    "measurements": [
      { "type": "agree", "verdict": "agree", "confidence": 0.9801980198019802, "explanation": "Sources converge with agreement score 0.980 at threshold 0.9.", "evidenceRefs": ["Mock Source A-0", "Mock Source B-1"] },
      { "type": "disagree", "verdict": "none", "confidence": 0.9801980198019802, "explanation": "Numeric spread 0.020 does not exceed disagreement threshold 0.1.", "evidenceRefs": ["Mock Source A-0", "Mock Source B-1"] },
      { "type": "conflict", "verdict": "none", "confidence": 0, "explanation": "No mutually exclusive categorical, boolean, or disjoint-range assertions were found.", "evidenceRefs": ["Mock Source A-0", "Mock Source B-1"] },
      { "type": "potential", "verdict": "none", "confidence": 0, "explanation": "Potential requires 3 observations; received 0.", "evidenceRefs": ["Mock Source A-0", "Mock Source B-1"] }
    ],
    "nodes": [{ "id": "DefaultMockConnector", "status": "on", "detail": "2 sources fetched", "observedAt": "2026-06-05T00:00:00.000Z" }],
    "ts": "2026-06-08T22:24:18.010Z",
    "masterHash": "0a5e1d83e9256cdc35e4cb716e3759d1237539be532d44afedd95148a0e10f95"
  }
}
```

**Workspace dep chain (unpublished packages):** No import errors for `@uvrn/lattice` or
`@uvrn/algox`. Workspace symlinks resolve correctly through local build. ✓

**Finding F1 — Missing `v_score` and `claimId` in MasterReceipt (Major):**

The returned `masterReceipt` has no top-level `v_score` field and does not echo back the
`claimId` passed as input. The pass criteria requires a "numeric v_score" — the closest
available value is `measurements[0].confidence = 0.9801` (for type "agree"), which is not
labelled as `v_score`.

This breaks the planned `delta_score_claim → delta_compare` pipeline:
- `delta_compare` requires `vScore` or `v_score` per receipt — not present in MasterReceipt
- `delta_compare` requires `claimId` or `claim_id` per receipt — not echoed in MasterReceipt

Users would need to:
1. Know to extract `measurements[0].confidence` as a proxy for `v_score`
2. Re-supply the `claimId` they originally passed (since it is not returned)

This is undocumented and not intuitive. Downstream workflows (POD research, Test 3b) depend
on this chain. Recommend either:
- (a) Add `v_score` and `claimId` to the MasterReceipt envelope (preferred)
- (b) Document the field mapping in CONNECT.md and the README

**Test 6b: PARTIAL PASS** — engine runs, no import errors, MasterReceipt returned; v_score
field absent per pass criteria.

---

### `delta_compare` — standalone verification

Tested with two synthetic scored receipts (using `claimId` + `vScore`):

```json
{
  "result": {
    "winner": { "claimId": "smoke-score-001", "vScore": 0.9801980198019802 },
    "loser":  { "claimId": "smoke-score-002", "vScore": 0.75 },
    "delta": 0.23019801980198018,
    "summary": "Claim smoke-score-001 leads with V-Score 1.0 vs smoke-score-002 at 0.8 for a delta of 0.2."
  }
}
```

Tool operates correctly when given proper inputs. Summary string rounds to 1 decimal place
(display only — raw `vScore` values in `winner`/`loser` are exact).

**`delta_compare` standalone: PASS**

---

## Open Decisions

### D1 — npx dependency strategy (pre-publish connector profiles)

All three committed connector profiles (`claude-desktop.json`, `hermes.config.yaml`,
`odysseus.md`) and the CONNECT.md smoke example use `npx -y @uvrn/mcp`. The published
package is a different, older lineage (v1.5.4). Pre-publish, any user copying these profiles
connects to the wrong version.

Current state of each profile:

| File | npx form | Local-build variant |
|---|---|---|
| `claude-desktop.json` | ✓ (only form) | ✗ |
| `hermes.config.yaml` | ✓ (only form) | ✗ |
| `odysseus.md` | ✓ | ✓ (`<ABSOLUTE_PATH_TO_REPO>` placeholder) |
| `CONNECT.md` smoke | ✓ (line 99) | ✗ in smoke section |

**Options (human must choose):**
- **(a)** Ship profiles with npx as-is; add a NOTE in each file and in CONNECT.md: "Requires
  publish of this branch — use local-build form until then." (Lowest effort.)
- **(b)** Add a local-build variant section to `claude-desktop.json` and `hermes.config.yaml`
  matching the pattern already in `odysseus.md`. Fix CONNECT.md smoke to show local-build form
  as the pre-publish alternative. (Most complete — no information loss.)
- **(c)** Bundle workspace deps into a self-contained tarball for a GitHub release artifact.
  (Requires release tooling; highest effort.)

### D2 — Claude Desktop local config missing

The `mcpServers.uvrn` entry was wiped from the local machine config. This is a local,
machine-specific operation (correct per pure-product principle) — but Test 3 and the POD
research validation cannot proceed until it is re-applied.

**Action:** Human re-adds the entry manually (node + absolute local path). Claude Desktop
must then be fully quit and relaunched.

---

## Summary Table

| Test | Result | Notes |
|---|---|---|
| Pre-flight | **PASS** | Branch current, all artifacts present, build clean |
| Test 1 — stdio smoke | **PASS** | `delta-engine-mcp` v1.2.0, 9 tools, no errors |
| Test 2 — Claude Code | **PASS** | 9 `mcp__uvrn__*` tools connected, functional |
| Test 3 — Claude Desktop | **BLOCKED** | `mcpServers.uvrn` absent from local config (D2) |
| Test 4 — Hermes | **SKIP** | Deferred to separate session |
| Test 5 — Odysseus | **SKIP** | Pending install |
| Test 6a — delta_validate_bundle | **PASS** | `valid: true` |
| Test 6b — delta_score_claim | **PARTIAL** | Engine runs, no import errors; `v_score` absent (F1) |
| delta_compare standalone | **PASS** | Winner/loser/delta correct |

---

## Before Branch Advances (publish / PR to main)

1. **Resolve F1** — add `v_score` and `claimId` to the MasterReceipt output of
   `delta_score_claim`. This unblocks the score → compare pipeline and the POD research test.
2. **Decide D1** — choose the connector profile strategy (options a/b/c above) and apply it.
3. **Re-apply D2** — patch Claude Desktop config, complete Test 3a/3b.
4. **Run Hermes session** — swap npx for local-build form, validate tool connection.
5. **Run Odysseus session** — use local-build variant from `odysseus.md`, validate connection.
