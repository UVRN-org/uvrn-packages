# ADR 0003: Replay determinism and timestamp policy

## Context

Receipts may include an optional `ts` (ISO timestamp). The engine adds `ts` only when `opts.timestamp` is provided; `hashReceipt` hashes the full payload, so presence or absence of `ts` changes the hash. Replay compares the original receipt to the replayed receipt; when one side included `ts` and the other did not, hashes differed and replay was reported as non-deterministic even when outcome, delta, and rounds were identical. There was no documented policy for when determinism should hold or how to normalize.

## Decision

- **Replay determinism compares the canonical payload excluding `ts`.** Two runs are considered deterministic if their normalized payloads (without the optional `ts` field) match. The stored `receipt.hash` remains over the full payload for integrity.
- **Normalized hash:** Core exports `hashReceiptPayloadWithoutTs(payload)` for consumers that need it; the SDK uses the same contract locally (strip `ts`, then hash) when deciding determinism in `replayReceipt`.
- **Result shape:** When full hashes differ but normalized hashes match (and semantic fields match), `replayReceipt` returns `deterministic: true` and sets `ReplayResult.timestampNormalized` so callers know the only difference was timestamp context. Optional `differences` may include an informational line (e.g. "hash (timestamp context differed; normalized hash match)").
- **Audit/compliance:** Verifiers can confirm that a receipt was produced deterministically from a bundle without requiring every executor to use the same timestamp.

## Status

Accepted. Implemented in 1.6.0: core `hashReceiptPayloadWithoutTs`; SDK `replayReceipt` uses normalized hash for determinism and sets `timestampNormalized`; replay matrix tests cover receipt/replay with and without `ts`. Documented in core and SDK READMEs and in [docs/reports/2026-03-17-validation-replay-contract.md](../reports/2026-03-17-validation-replay-contract.md).
