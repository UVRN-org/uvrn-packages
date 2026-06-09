# Design Doc — MCP Runtime Config Model (gate for Phase 3+)

**Target agent**: Claude Code (design) → Cursor / Codex (implementation)
**Package**: `@uvrn/mcp` (LIVE)
**Status**: DESIGN — must be defined and approved **before any stateful MCP tool is built**
**Protocol**: Bloom v1.7 (Plan/Design stage)
**Source**: report §3; architecture §6, §7

---

## Why this exists

Phases 3+ add tools that need stores, signers, and connectors. Without a config model, those choices
get hardcoded — violating the open/agnostic standard. This doc defines **how an instance declares
which stores/signers/connectors are active**, with a zero-external default. It governs Phase 3 (canon)
and Phase 4 (live scoring). **No stateful tool may be built until this is in place.**

## The model

Extend the current env-only `ServerConfig` (`uvrn-mcp/src/config.ts`: `LOG_LEVEL`, `STORAGE_PATH`,
`MAX_BUNDLE_SIZE`, `VERBOSE_ERRORS`) into a `RuntimeConfig`:

```ts
export interface RuntimeConfig extends ServerConfig {
  // @uvrn/canon takes a CanonConfig: { stores: CanonStore[], signer: CanonSigner, autoSuggest, canonizerId }
  canonStores?: CanonStore[];       // array (matches CanonConfig.stores); default [new MockStore()]
  canonSigner?: CanonSigner;        // @uvrn/canon's CanonSigner (e.g. MockSigner); default MockSigner
  identityStore?: IdentityStore;    // default MockIdentityStore
  timelineStore?: TimelineStore;    // default MockTimelineStore
  connectors?: FarmConnector[];     // FarmConnector + ClaimRegistration come from @uvrn/agent.
                                    // default [] or a mock connector — NEVER CoinGeckoFarm
}
```

> **API note (verified):** `CanonStore` reads via `read(canonId)` (not `get()`). `CanonConfig` wants
> `stores: CanonStore[]` (array) + a `CanonSigner`. The MCP layer constructs a `Canon` from these.

### Injection wiring (implementation-complete — decided)

The config must be *injected*, not read from module globals, so tests and hosts can supply their own:

```ts
export function createServer(runtimeConfig?: RuntimeConfig): Server;  // optional; defaults to mock matrix
function buildHandlers(cfg: RuntimeConfig): Handlers;                 // factory closes over cfg
```

- `createServer(runtimeConfig?)` takes an **optional** `RuntimeConfig`. If omitted, it builds the
  zero-external default matrix (mock stores/signer, no connectors).
- Internally, `buildHandlers(cfg)` is a **factory** that closes over the resolved config and returns
  the tool handlers; `server.setRequestHandler(...)` uses those. **No module-global singletons.**
- The existing env-driven `loadConfig()` stays as the **default source**; an explicit `runtimeConfig`
  argument **overrides** it.
- **Tests** inject directly: `createServer({ canonStores: [new MockStore()], ... })`.
- **Every Phase 3+ tool** receives its stores/connectors through this injected `cfg` — never imports a
  global. This is the single, required dependency path.

- **Resolution precedence**: explicit startup argument → config file → environment → built-in default.
- **Zero-external default matrix** (must give a fully functional system, no signup, any machine):
  | Capability | Default |
  |---|---|
  | Canon stores | `[new MockStore()]` (in-memory) |
  | Canon signer | `MockSigner` |
  | Identity store | `MockIdentityStore` |
  | Timeline store | `MockTimelineStore` |
  | Connectors | none / mock connector |
- **Injection, not coupling**: stores/signers/connectors are supplied through their documented
  `@uvrn/*` interfaces. A host passes its own implementation; protocol logic never names a service.
- **Discoverable**: the active config (capabilities present, which are mock vs real) is exposed so a
  connecting agent can self-configure — consistent with the agnostic principle (architecture §7).

## Check (design acceptance)

- A reviewer can answer, for any tool: "which store/signer/connector does it use, and how is it
  supplied?" without finding a hardcoded service.
- The default config runs the full surface with zero external services.

## Update

- `uvrn-mcp/README.md`: a "Configuration" section — the precedence order, the default matrix, and a
  worked example of supplying a custom store/connector.

## Continue

- Once approved, Phase 3 (`BUILD-mcp-phase3-canon.md`) and Phase 4 (`BUILD-mcp-phase4-live-scoring.md`)
  may consume `RuntimeConfig`.

---

## MUST NOT include

- ❌ Any default that names a specific provider/service (no default `CoinGeckoFarm`, etc.).
- ❌ A config that makes external services *required* for the base surface to function.
- ❌ Building stateful tools in this doc — design only.
