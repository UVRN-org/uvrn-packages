# @uvrn/api

UVRN REST API — HTTP server for Delta Engine bundle processing. Exposes run, validate, and verify over HTTP so any client (browser, script, or service) can call the engine without installing the core or SDK. **Release:** 1.5.1.

**Disclaimer:** UVRN is in Alpha testing. The engine measures whether your sources agree with each other — not whether they’re correct. Final trust of output rests with the user. Use at your own discretion. Have fun.

*UVRN makes no claims to "truth", the "verification" is the output of math — it is up to any user to decide if claim is actually "true" — Research and testing are absolutely recommended per use case and individual system!!*

## Install

```bash
npm install @uvrn/api
```

Or with pnpm:

```bash
pnpm add @uvrn/api
```

## Usage

1. **Start the server** (default port 3000):

```bash
npx @uvrn/api
```

Or from your app:

```typescript
import { startServer, createServer } from '@uvrn/api';

// Default: start with default config (port 3000)
await startServer();

// Or create server with custom config, then listen
const server = await createServer({ port: 4000 });
await server.listen({ port: 4000, host: '0.0.0.0' });
```

2. **Send a bundle** (e.g. POST to `/api/v1/delta/run`) and get a receipt in the response. Use `/api/v1/delta/validate` and `/api/v1/delta/verify` for validation and verification.

Example with curl:

```bash
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Content-Type: application/json" \
  -d '{"bundleId":"example-001","claim":"Compare sources","thresholdPct":0.1,"dataSpecs":[...]}'
```

## Use cases

- **Expose the engine over HTTP** — Let frontends, scripts, or other services run the Delta Engine without a local Node dependency.
- **Centralized verification service** — Run one API instance and have many clients submit bundles and get receipts.
- **CI or automation** — Call the API from pipelines to run comparisons and verify receipts.

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-api`)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core used by this server
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line instead of HTTP
