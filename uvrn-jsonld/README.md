# `@uvrn/jsonld`

Offline JSON-LD **projection** of UVRN receipts.

The linked-data form is a **separate object graph**. It never mutates a receipt
passed to `hashReceipt` / JCS, and `@context` never enters a frozen hash field
list (`SPEC/uvrn-typed-observation-v1.md` §11).

## Placement

Leaf package: depends on nothing that hashing imports; nothing depends on this
package (workspace cycles stay at zero). Hash/canonicalization paths in
`@uvrn/core` and `@uvrn/receipt` are untouched.

## Offline validator

Evidence names **jsonld.js** (`npm` package `jsonld`) with an offline
`documentLoader` that serves only the committed context IRI
`https://uvrn.org/context/receipt-v1.jsonld` from
`context/uvrn-receipt-context-v1.jsonld`. Remote fetches throw.

## Usage

```ts
import {
  projectReceiptToJsonLd,
  expandOffline,
  OFFLINE_LINKED_DATA_VALIDATOR,
} from '@uvrn/jsonld';

const projection = projectReceiptToJsonLd(receipt); // new object
const expanded = await expandOffline(projection);   // offline only
```
