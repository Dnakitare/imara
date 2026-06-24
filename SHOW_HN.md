# Show HN: Imara – YAML policy enforcement for MCP agents

**Title:** Show HN: Imara – policy enforcement layer for MCP agents (npx imara)

---

**Body:**

I built Imara because I kept running into the same problem: AI agents doing real work (writing files, pushing to git, calling APIs) with no way to set guardrails short of forking the agent itself.

Imara is an MCP proxy that sits between your agent and your MCP servers. You define rules in YAML — block force pushes to main, rate-limit writes to 20/minute, flag destructive ops for review — and Imara evaluates every tool call before it reaches the server. Your agent is unchanged. No SDK changes. `npx imara` patches your existing `.mcp.json` or Claude Desktop config and opens a dashboard.

The policy engine supports four actions: `allow`, `deny`, `escalate`, and `log`. Rules match by tool name (exact or glob), server name, and argument values. Ships with sensible defaults.

There's also a local SQLite audit trail with SHA-256 hash chaining — `imara verify` checks integrity. The audit log maps to EU AI Act Art. 12 (automatic event logging) and Art. 14 (human oversight), which go into effect August 2 for high-risk AI systems. That wasn't the original motivation, but it's become relevant quickly.

Tech: TypeScript monorepo, 6 packages, 88 tests, Apache 2.0.

Repo: https://github.com/Dnakitare/imara
npm: https://www.npmjs.com/package/imara

The thing I'm most uncertain about is the right level of abstraction for the policy DSL. Right now it's declarative YAML with glob matching and argument predicates. I considered making it code (a TypeScript function per rule) but that felt like too much friction for the "add a guardrail in 2 minutes" use case. Curious if others have opinions on that tradeoff.

---

**Notes for posting:**
- Post on a weekday between 9-11am ET for best visibility
- Monday/Tuesday tend to perform better for Show HN than Friday
- Watch comments for the first 2 hours and reply to every substantive one
- The policy DSL tradeoff question at the end is intentional — it invites discussion
- Tag: ask_hn, show_hn
