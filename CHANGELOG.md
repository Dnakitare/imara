# Changelog

## 0.2.0 — 2026-06-26

### Changed (breaking)

- **Audit hash format changed.** Event payloads are now canonically serialized (nested object keys sorted) before hashing, so semantically identical events hash the same regardless of key order. Logs written by 0.1.x will not verify under 0.2.0. Treat 0.2.0 as a fresh baseline: archive any `~/.imara/audit.db` you need to keep, then run `imara verify` to establish a new anchor.

### Added

- Genesis anchoring in chain verification: the first event must have a null `prevHash`, so deleting a prefix of the log is detected.
- Truncation and rewrite detection via a head anchor recorded in `~/.imara/anchor.json` on each `imara verify`; divergence from the recorded head or event count is flagged on the next run.

### Fixed

- `verifyChain` now requires each event's stored hash and recomputes it unconditionally; previously an event with no stored hash was silently accepted as valid.
- `imara verify` paginates the entire log instead of stopping at the first 10,000 events.
- `escalate` decisions fail closed in the proxy (the call is held for human approval) instead of being forwarded like `allow`.
- `AuditStore.append()` rejects any row whose hash does not match its contents.
- Chain verification reads events in insertion order, so clock skew or backdated timestamps no longer cause false integrity failures.

### Removed

- The unused `--session` flag on `imara verify`.
