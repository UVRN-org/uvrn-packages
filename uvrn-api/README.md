# @uvrn/api

UVRN REST API — HTTP server for Delta Engine bundle processing. Exposes run, validate, and verify over HTTP so any client (browser, script, or service) can call the engine without installing the core or SDK.

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

const server = await createServer();
await startServer(server);
```

2. **Send a bundle** (e.g. POST to `/delta/run`) and get a receipt in the response. Use `/delta/validate` and `/delta/verify` for validation and verification.

Example with curl:

```bash
curl -X POST http://localhost:3000/delta/run \
  -H "Content-Type: application/json" \
  -d '{"bundleId":"example-001","claim":"Compare sources","thresholdPct":0.1,"dataSpecs":[...]}'
```

## Use cases

- **Expose the engine over HTTP** — Let frontends, scripts, or other services run the Delta Engine without a local Node dependency.
- **Centralized verification service** — Run one API instance and have many clients submit bundles and get receipts.
- **CI or automation** — Call the API from pipelines to run comparisons and verify receipts.

## Links

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-api`)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core used by this server
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line instead of HTTP
