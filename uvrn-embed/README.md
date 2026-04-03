# @uvrn/embed

`@uvrn/embed` is the embeddable UVRN badge layer. It fetches live claim status from a configurable API endpoint and renders that status as either a React component or a standalone UMD widget for plain HTML pages.

## Minimal install

React usage:

```bash
npm install @uvrn/embed react react-dom
```

UMD usage:

- No package install required
- Serve `dist/embed.umd.js` and load it with a `<script>` tag

## React usage

```ts
import { ConsensusBadge } from '@uvrn/embed';

<ConsensusBadge
  claimId="clm_sol_001"
  apiUrl="https://api.uvrn.org"
  theme="dark"
  showScore={true}
  showStatus={true}
/>
```

## Plain HTML / UMD usage

```html
<script src="/path/to/embed.umd.js"></script>
<div
  data-uvrn-claim="clm_sol_001"
  data-uvrn-api="https://api.uvrn.org"
  data-uvrn-theme="dark"
></div>
```

Programmatic control:

```js
UVRN.renderBadge(element, {
  claimId: 'clm_sol_001',
  apiUrl: 'https://api.uvrn.org',
  theme: 'dark',
});

UVRN.init();
```

## Self-hosting

`apiUrl` is configurable. The default is `https://api.uvrn.org`, but you can point the badge at a self-hosted `@uvrn/api` deployment or any compatible endpoint implementing:

`GET {apiUrl}/claims/{claimId}/status`

The response must include at least:

```json
{
  "status": "STABLE",
  "vScore": 91
}
```

## Cache behavior

- In-memory cache only
- Default TTL: 60 seconds
- Override TTL with `cacheMs`
- Cache is keyed by `claimId`
- No `localStorage`, cookies, or persistent browser storage

## Public API

- `ConsensusBadge`
- `BadgeProps`
- `BadgeData`
- `BadgeStatus`
- `window.UVRN.init()`
- `window.UVRN.renderBadge()`

## Dependencies

- Peer dependencies: `react`, `react-dom`
- UMD runtime dependencies: none
