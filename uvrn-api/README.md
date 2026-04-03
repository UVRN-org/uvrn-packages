# @uvrn/api

UVRN REST API — HTTP server for Delta Engine bundle processing. Exposes run, validate, and verify over HTTP so any client (browser, script, or service) can call the engine without installing the core or SDK.

**Package provides:** Fastify server; `createServer` / `startServer`; routes for `/api/v1/delta/run`, `/api/v1/delta/validate`, `/api/v1/delta/verify`, `/api/v1/health`. Uses `@uvrn/core`. Config via env (PORT, HOST, CORS_ORIGINS, etc.).

**You provide:** In production — restrict `CORS_ORIGINS` to your frontend origin(s). Optionally port, host, rate limits. No custom auth or storage in the base package.

## Install

```bash
npm install @uvrn/api
```

Or with pnpm:

```bash
pnpm add @uvrn/api
```

## Usage

1. **Start the server** (default port 3000). After building (`pnpm build` in the repo, or use the published package):

```bash
npx @uvrn/api
```

Or from your app:

```typescript
import { startServer, createServer } from '@uvrn/api';

const server = await createServer();
await startServer(server);
```

2. **Endpoints** are under `/api/v1/`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/delta/run` | Execute engine on bundle, return receipt |
| POST | `/api/v1/delta/validate` | Validate bundle schema |
| POST | `/api/v1/delta/verify` | Verify receipt replay |
| GET | `/api/v1/health` | Health check |

Example with curl:

```bash
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Content-Type: application/json" \
  -d '{"bundleId":"example-001","claim":"Compare sources","thresholdPct":0.1,"dataSpecs":[...]}'
```

**Security:** The default CORS setting allows all origins (`*`). For production, set `CORS_ORIGINS` to your frontend origin(s) (e.g. `https://app.example.com`) so only trusted clients can call the API.

## Use cases

- **Expose the engine over HTTP** — Let frontends, scripts, or other services run the Delta Engine without a local Node dependency.
- **Centralized verification service** — Run one API instance and have many clients submit bundles and get receipts.
- **CI or automation** — Call the API from pipelines to run comparisons and verify receipts.

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-api`)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core used by this server
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line instead of HTTP
