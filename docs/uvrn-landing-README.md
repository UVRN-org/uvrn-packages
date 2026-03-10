# UVRN — Universal Verification Receipt Network

**UVRN** is an open protocol for producing cryptographically verifiable receipts from multi-source data. Use it to attest existence and integrity of consensus results (e.g. price feeds, reconciled data) without a blockchain.

---

## Main repository

Code, issues, and contributions live here:

**[→ UVRN-org/uvrn-packages](https://github.com/UVRN-org/uvrn-packages)**

---

## Repositories

- **uvrn-packages** — Main codebase (Delta Engine, CLI, API, MCP, adapter). Published as `@uvrn/*` on npm. [GitHub](https://github.com/UVRN-org/uvrn-packages)
- **uvrn-base** — Protocol home (schemas, receipts, validation). [www.uvrn.org](https://www.uvrn.org). [GitHub](https://github.com/UVRN-org/uvrn-base)

---

## Packages on npm

| Package | Description |
| -------- | ----------- |
| [@uvrn/core](https://www.npmjs.com/package/@uvrn/core) | Delta Engine core (run, validate, verify) |
| [@uvrn/sdk](https://www.npmjs.com/package/@uvrn/sdk) | TypeScript SDK |
| [@uvrn/cli](https://www.npmjs.com/package/@uvrn/cli) | CLI (bundle → receipt) |
| [@uvrn/api](https://www.npmjs.com/package/@uvrn/api) | REST API server |
| [@uvrn/mcp](https://www.npmjs.com/package/@uvrn/mcp) | MCP server for AI assistants |
| [@uvrn/adapter](https://www.npmjs.com/package/@uvrn/adapter) | DRVC3 envelope adapter (EIP-191 signing) |

**Quick start:** `npm install @uvrn/core @uvrn/sdk` — see [uvrn-packages](https://github.com/UVRN-org/uvrn-packages) for full docs.

---

## License

MIT
