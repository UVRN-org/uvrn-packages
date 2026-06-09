# Build Plan — MCP Phase 4: Live Scoring (side doc)

**Target agent**: Cursor / Codex
**Package**: `@uvrn/mcp` (LIVE)
**Depends on**: `DESIGN-mcp-config-model.md`; `@uvrn/farm`, `@uvrn/normalize`, `@uvrn/consensus`, `@uvrn/core`, `@uvrn/agent` (source of `FarmConnector` + `ClaimRegistration`)
**Protocol**: Bloom v1.7
**Source**: report §5; architecture §6, §7

---

## Plan

Add `delta_score_claim(claim) → MasterReceipt` — the "give Claude a claim, get a live, sourced,
verifiable result" tool. Provider-agnostic by construction: connectors come from `RuntimeConfig`,
never a hardcoded default.

## Build

1. **Pipeline** (no service names in the logic):
   ```
   configured FarmConnector[]  →  @uvrn/normalize  →  @uvrn/consensus  →  @uvrn/core (engine)  →  receipt
                                                                                      ↓
                                          measurements (@uvrn/measure) + node status → MasterReceipt
   ```
2. **Connectors from config.** Read `connectors` from `RuntimeConfig`. If none supplied, use the
   mock/in-memory connector (zero-external path). `CoinGeckoFarm` etc. are **reference connectors,
   documented as examples — never the default.**
   - **Verified signature:** `FarmConnector.fetch(claim: ClaimRegistration): Promise<FarmResult>`.
     `FarmConnector` and `ClaimRegistration` are declared in **`@uvrn/agent`** (not `@uvrn/farm`).
     `fetch` takes a **structured `ClaimRegistration`**, not a bare string.
   - **Adapter required:** the tool's `claim: string` input must be mapped to a `ClaimRegistration`
     before calling a connector. Specify this adapter explicitly (claim text + registration metadata →
     `ClaimRegistration`); do not pass the raw string to `fetch`.
3. **Node status capture.** Record each connector's outcome — `on` / `off` / `unavailable` (timeout,
   auth failure, empty) — into the master receipt's `nodes[]`. A down source is reported, not dropped silently.
4. Tool wiring uses the same 4-place pattern (handlers, schemas, types, both server registrations).
   Output is a `MasterReceipt` (see `BUILD-core-master-receipt.md`), so the result is verifiable and
   carries measurements + node status, not a bare score.
5. Peer deps: add `@uvrn/farm`, `@uvrn/normalize`, `@uvrn/consensus`, **and `@uvrn/agent`** (source of
   `FarmConnector` + `ClaimRegistration`) (`>=1.0.0`); `@uvrn/measure` if measurements are attached here.
   devDeps `workspace:*`. No circular deps.

## Check

- `pnpm --filter @uvrn/mcp run build` + `run test` green.
- Tests with a **mock connector**: end-to-end claim → MasterReceipt, `verifyMasterReceipt` passes.
- Simulate a down connector → its entry appears in `nodes[]` as `off`/`unavailable`; scoring still
  completes on the remaining sources.
- Confirm **no** code path references a specific provider by default.

## Update

- `uvrn-mcp/README.md`: document `delta_score_claim`, the pipeline, supplying connectors via config,
  and the "reference connector ≠ default" rule. (README may list market/product/prediction-market
  trend-sensing as *example applications* — framed "sense direction, not forecast" — not features.)
- `uvrn-mcp/CHANGELOG.md`: minor bump.

## Reflect

- Log connector-interface friction or partial-failure semantics in `.admin/findings/`.

## Continue

- Proceed to `BUILD-mcp-phase5-plugin-packaging.md`.

---

## MUST NOT include

- ❌ Defaulting to `CoinGeckoFarm` or any named provider — connectors come from config.
- ❌ Coupling tool logic to a specific service at the type level.
- ❌ Dropping a failed source silently — node status must be recorded.
- ❌ Returning a bare score instead of a verifiable `MasterReceipt`.
- ❌ Trend/forecast logic in package code (README example only).
