# @uvrn/api

UVRN REST API — HTTP server for Delta Engine bundle processing. Exposes run, validate, and verify over HTTP so any client (browser, script, or service) can call the engine without installing the core or SDK.

**Package provides:** Fastify server; `createServer` / `startServer`; routes for `/api/v1/delta/run`, `/api/v1/delta/validate`, `/api/v1/delta/verify`, `/api/v1/health`. Uses `@uvrn/core`. Config via env (PORT, HOST, CORS_ORIGINS, etc.).

**You provide:** In production — restrict `CORS_ORIGINS` to your frontend origin(s) and set `UVRN_API_KEY` to require authentication on the delta routes. Optionally port, host, rate limits. No storage in the base package.

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

## Authentication (optional)

The API is open by default. To require an API key on the delta routes (`/api/v1/delta/*`), configure one or more keys; `/api/v1/health` and `/api/v1/version` always stay open so probes and load balancers keep working.

| Config | Env var | Default | Behavior |
|---|---|---|---|
| `apiKey` | `UVRN_API_KEY` | unset | Single accepted key. |
| `apiKeys` | `UVRN_API_KEYS` (comma-separated) | unset | Accepted key list (useful for rotation). Merged with `apiKey`. |

When no key is configured, behavior is identical to previous versions (open). When configured, clients authenticate with either header — the same convention as the UVRN worker:

```bash
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Authorization: Bearer $UVRN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @bundle.json

# or equivalently:
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "X-UVRN-API-Key: $UVRN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @bundle.json
```

Requests without a valid key receive `401 { "error": { "code": "UNAUTHORIZED", ... } }`. Key comparison is constant-time (`crypto.timingSafeEqual` after a length check).

## CORS lockdown

The server sets CORS headers via `@fastify/cors` driven by the `corsOrigins` config (env `CORS_ORIGINS`, comma-separated). **The default is `*` (allow all origins) for frictionless local development — lock it down in production:**

```bash
CORS_ORIGINS="https://app.example.com,https://admin.example.com" npx @uvrn/api
```

Notes:

- CORS only restricts browsers; it is not authentication. Server-to-server clients ignore it — use the API key above (or a reverse proxy) for real access control.
- If you terminate TLS at a reverse proxy (nginx, Caddy, Cloudflare), prefer setting CORS and auth there as well, and keep the API bound to a private interface (`HOST=127.0.0.1`).

## Use cases

- **Expose the engine over HTTP** — Let frontends, scripts, or other services run the Delta Engine without a local Node dependency.
- **Centralized verification service** — Run one API instance and have many clients submit bundles and get receipts.
- **CI or automation** — Call the API from pipelines to run comparisons and verify receipts.

## Links

**Open source:** Source code and issues: [GitHub (uvrn-packages)](https://github.com/UVRN-org/uvrn-packages). Project landing: [UVRN](https://github.com/UVRN-org/uvrn).

- [Repository](https://github.com/UVRN-org/uvrn-packages) — monorepo (this package: `uvrn-api`)
- [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) — Delta Engine core used by this server
- [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) — run the engine from the command line instead of HTTP
