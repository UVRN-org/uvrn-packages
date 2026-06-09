# Storage Guidance — "Dear Agents & Devs"

**Status**: Guidance (a pattern, not a mandate)
**Audience**: build agents (Cursor/Codex) and developers adopting UVRN
**Lane**: Claude Cowork — guidance doc, no runtime code
**Date**: 2026-06-04

---

## The one rule

**UVRN never owns or manages your storage.** The protocol holds no database, requires no signup, and
ships no default backend. Core, drift, and agent store **nothing**. Where data needs to persist, the
package leaves a **slot** (a small interface) and you fill it. This is a first-class design rule, not
a limitation — it's what lets UVRN run anywhere: a laptop, a company database, object storage, or a
chain, without the protocol caring.

This doc says, in basic form: *here is **a** way storage can work.* It is an example pattern. It is
**not** the required way, and it must never become one.

---

## How storage works (the pattern)

Each package that touches persistence defines its own slot:

| Package | Slot (interface) | Stores |
|---|---|---|
| `@uvrn/canon` | `CanonStore` (`save` / `read` / `list`) | permanent signed canon records |
| `@uvrn/timeline` | `TimelineStore` (`getSnapshots` / `getCanonEvents`) | claim history reads |
| `@uvrn/identity` | `IdentityStore` (`getReputation` / `saveReputation` / …) | signer reputation |
| `@uvrn/watch` | `NotifyTarget` (delivery, not storage — same plug-in shape) | alert delivery |

Three levels of use:

1. **Zero-setup (default).** Each package ships an in-memory mock (`MockStore`, `MockTimelineStore`,
   `MockIdentityStore`). Data lives in RAM and is gone when the process stops. Perfect for tests,
   demos, and the zero-external path. **This always works, with no signup.**
2. **Real use.** Implement the slot's interface against your backend (SQL, Supabase, R2, KV, IPFS,
   on-chain — your choice) and pass it in. Nothing else changes.
3. **Reference examples.** Some packages ship example backends (e.g. canon's Supabase/R2/IPFS). These
   are **starting points to copy, not defaults to depend on.**

### Shape of the pattern (illustrative)

```ts
// 1. Implement the slot against your backend.
class MyTimelineStore implements TimelineStore {
  async getSnapshots(claimId, from, to) { /* read from your DB */ }
  async getCanonEvents(claimId, from, to) { /* read from your DB */ }
}

// 2. Plug it in. UVRN logic is unchanged.
const timeline = new Timeline({ store: new MyTimelineStore() });

// Default, zero-setup alternative:
const timeline = new Timeline({ store: new MockTimelineStore() });
```

---

## Rules a build agent must keep

- **Never add storage to `@uvrn/core`, `@uvrn/drift`, or `@uvrn/agent`.** (ROADMAP §6, AGENTS.md.)
- **Never make a real backend the default.** The in-memory mock is the default; external services are
  always opt-in.
- **Never couple package logic to a named service** at the type level. The interface is the contract;
  the service is an example.
- **The zero-external path must always work.** If removing a third-party service breaks a package's
  core behavior, something was coupled that shouldn't be — move the service code into a separate,
  optional implementation file.
- **Document the slot in the package README:** "this is the interface you implement" vs. "this is a
  reference implementation."

---

## On a `@uvrn/storage` package (parked idea, not approved)

A central storage package is **not** part of the protocol and would cut against package independence
if other packages depended on it. The only version consistent with the rules above is an **optional,
leaf-level "bring-your-own-backend" bundle**: a package that *implements* several slots (so a user
installs one thing and gets real storage in multiple places), that **nothing else depends on**, that
**depends on the others (never the reverse)**, and that is **never a default**. Captured here as a
future convenience only — no build action implied.

---

*Provider-agnostic by default. Interfaces are the contract; implementations are examples.*
