# UVRN Real-Test Demo Platform

This workspace is a browser-first demo harness for the raw `uvrn-packages-next-2` packages. It exercises the packages through realistic integration boundaries, keeps the default path zero-external, and records findings about package independence, combination behavior, and required glue.

## Workspace

- `apps/mock-ingest`: local provider-style mock ingestion endpoints
- `apps/demo-api`: local demo backend and scenario result API
- `apps/web`: Vite dashboard for scenario review, docs, findings, and embed demos
- `packages/scenarios`: scenario runners, findings model, artifact generation, and shared fixtures
- `docs/findings.md`: generated narrative summary of results

## Commands

```bash
pnpm install
pnpm run build
pnpm run dev
```

Useful single commands:

```bash
pnpm run refresh:uvrn
pnpm run generate
pnpm run smoke
```

## Local URLs

- Web: `http://127.0.0.1:4173`
- Demo API: `http://127.0.0.1:4174`
- Mock ingest: `http://127.0.0.1:4175`

## Notes

- The demo consumes UVRN packages via local `file:` dependencies pointing at the raw package folders.
- Published `@uvrn/*` packages are not installed here.
- The default demo path uses deterministic mock data served over HTTP and fetched through connector logic.
