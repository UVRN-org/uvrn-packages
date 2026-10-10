# SCRIBE — dual-source read and how to speak UVRN

Universal instructions for agents that report on UVRN work: pull the **book** and the **article**, join them, then speak for a human without treating interpretation as proof.

This file does not add hashed fields. It does not replace `SPEC/` or `toHumanView`.

## Two stores, one join

| Store | What it is | How to pull |
|-------|------------|-------------|
| **Book** | Signed receipts in D1, behind the worker | HTTP GET only (below). Do **not** SQL the worker’s D1 binding. |
| **Article** | Human research / log JSON (claim, findings, slug, run id) | Consumer log or archive. Home example below. Other products may have their own JSON; the join rule is the same. |

**Join key:** the article’s `receiptHash`. Strip a `sha256:` prefix if present. `GET` that bare hash on the book.

- **GET 200** — book row exists. Copy `registryId`, `source`, `flags`.
- **GET 404** — article without a book row. Say that plainly. Do **not** invent a ledger id.
- Never treat a log hash as a D1 row.
- Never treat a D1 miss as “the research is gone.”
- Never copy the full article JSON into the receipt book.

```text
article JSON  --receiptHash-->  GET /receipts/<bare-hash>  -->  two-column report
                                        |
                                 toHumanView(receipt)
```

## Pull — book (D1 via worker)

Default worker: `https://uvrn-worker.uvrn-workers.workers.dev`

```http
GET /receipts/<bare-hash>
GET /search?source=<source>
```

Example source for Home Expanse/POD cycles: `uvrn-expanse-agent`.

**Read** is public GET. Do not print `UVRN_WORKER_KEY` or private keys. **Write** (POST a receipt) is a different path and still needs the ingest key; it is out of this file’s read protocol.

Do not backfill old 404 hashes into D1 (re-attestation forbidden). Fix forward emits only.

## Pull — article (JSON)

**Home example** (other products substitute their own log):

- Working tree: `src/data/expanse-log.json` in `uvrn-home` / `uvrn_home-1_v2`.
- Public article: `/research/<slug>` (archive / R2). Page chrome is Home’s job, not this file.

From each article, take at least: claim, findings, slug, run id (or equivalent), `receiptHash`.

## Two-column report (required shape)

Better reports always have **both** columns, joined on hash.

**Article column**

- Claim, findings, slug, run id (or product equivalent).
- Outcome the article recorded (`CONSENSUS` / `INDETERMINATE`, delta, tiers) — as the log states them.

**Book column**

- GET URL and HTTP status.
- `registryId` if 200; omit or mark missing if 404.
- `flags` (display chips, not a rewrite of the hash).

If the columns disagree (article present, book 404), that is a real finding, not a reason to hide the article.

## Interpret and display (not hashed)

Prefer existing render law. Do not invent a second verdict language.

- [`toHumanView`](../uvrn-receipt/src/render/index.ts) (`HumanView`) is the structured, UI-agnostic human object: headline, verdict label/tone, claim, score card, sources, measurements, gaps, provenance, how-to-verify. Any renderer (chat, CLI, HTML) can present it without protocol knowledge.
- Hash recompute alone is **integrity-checked**. **Verified** requires integrity **and** a producer signature that checks out (`SPEC/uvrn-signing-v1.md`). Same rule as root [`AGENTS.md`](../AGENTS.md).
- Flags such as `SIGNATURE_KEY_UNKNOWN` and `SIGNATURE_VERIFIED` are **display chips**. They do not change the hash.
- `CONSENSUS` and `INDETERMINATE` stay honest. INDETERMINATE is a valid result.
- **T0** means unmapped host, not junk. Do not relabel it as discarded evidence.
- Narrative, scribe prose, and “what this means for a seller” are **interpretation sidecars**. Do not hash them. Do not add them to the frozen receipt field list (`SPEC/uvrn-receipt-v1.md`).

## Walls (do not violate)

1. Additive-only against live receipts. This file adds **no** hashed fields.
2. Honest vocabulary in chat, docs, and UI strings — never more than the math proves.
3. Book via worker HTTP; article via consumer JSON; join on `receiptHash`.
4. No secrets in reports. No D1 SQL from consumer agents. No stuffing articles into the book.

## Cite

- Binding laws: [`AGENTS.md`](../AGENTS.md)
- Receipt human render: `uvrn-receipt` `toHumanView` / `HumanView`
- Hash contract: `SPEC/uvrn-receipt-v1.md`
- Signing honesty: `SPEC/uvrn-signing-v1.md`
