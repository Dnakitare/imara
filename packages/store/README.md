# @imara/store

> **Frozen — moved to Mavryn (April 2026).** This package is no longer
> developed. Its hash-chained SQLite audit store has been absorbed into
> [Mavryn](https://github.com/Dnakitare/mavryn) v0.2 with an extended
> schema (SDK enrichment columns, per-user attribution, RFC 8785
> canonical hashing) and additional correctness fixes (insertion-order
> chain via `seq`, multi-process safety via `BEGIN IMMEDIATE` +
> `UNIQUE(prev_hash)`).
>
> `@imara/store@0.1.1` remains installable on npm and continues to work
> as released. New users should reach for Mavryn directly.

Hash-chained, tamper-evident audit storage for AI agent tool calls.

- Atomic append inside a single SQLite transaction
- SHA-256 chain over a positional payload
- Standard CRUD + filtered queries
- 19 tests covering the chain-correctness invariant

## Install

```bash
npm install @imara/store
```

## Usage

```ts
import { SqliteAuditStore } from "@imara/store";

const store = new SqliteAuditStore("./audit.db");

const event = store.appendAtomic({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  sessionId: "sess-1",
  serverName: "github",
  toolName: "create_issue",
  toolArguments: { title: "bug" },
  policyDecision: "allow",
  policiesEvaluated: [],
});

console.log(event.eventHash, event.prevHash);
```

## License

Apache-2.0
