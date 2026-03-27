# Imara

[![CI](https://github.com/Dnakitare/imara/actions/workflows/ci.yml/badge.svg)](https://github.com/Dnakitare/imara/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**Runtime governance layer for AI agents.** See every tool call. Enforce policies. Prove compliance.

Imara sits between your AI agent and the tools it uses, providing tamper-proof audit trails, policy enforcement, and a real-time dashboard — with zero config changes to your agent.

## Get Started

One command. That's it.

```bash
npx imara
```

This will:
- Auto-detect and wrap your MCP servers
- Load a demo session so you can explore immediately
- Open the dashboard at `http://localhost:3838`

<!-- TODO: Add dashboard screenshot here after first deploy -->

## What You Get

### Transparent MCP Proxy
Imara wraps your existing MCP servers. Your agent doesn't know it's there. Every tool call flows through Imara, gets logged, and is evaluated against your policies.

### Cryptographic Audit Trail
Every event is SHA-256 hash-chained. If anyone tampers with the log, the chain breaks. Run `imara verify` to check integrity at any time.

### Policy Engine
Define rules in YAML. Block destructive operations, rate-limit writes, flag high-risk actions. Ships with sensible defaults out of the box.

```yaml
- name: block-force-push-to-main
  priority: 10
  match:
    tools:
      - tool: git_push
      - tool: git_force_push
    arguments:
      - field: branch
        operator: in
        value: [main, master, production]
  action: deny
  reason: Force push to protected branches is not allowed
```

### Real-Time Dashboard
Visual timeline of every agent action with policy decision badges, latency metrics, and session grouping. The risk summary tells you at a glance what your agents have been doing.

### Zero-Config Setup
`imara wrap` reads your existing `.mcp.json` or Claude Desktop config, wraps every server entry to route through the proxy, and saves a backup. `imara unwrap` restores the original. No manual config editing.

## CLI Commands

| Command | Description |
|---------|-------------|
| `imara` | Full setup: init + wrap + dashboard |
| `imara init` | Initialize `~/.imara/` config and database |
| `imara wrap` | Auto-patch MCP config to route through proxy |
| `imara unwrap` | Restore original MCP config from backup |
| `imara tail` | Live stream audit events in terminal |
| `imara tail -f` | Follow mode — watch events as they happen |
| `imara dashboard` | Open the web dashboard |
| `imara verify` | Verify hash chain integrity |
| `imara status` | Show monitoring stats |

## How It Works

```
Your Agent          Imara Proxy              Real MCP Server
    │                    │                        │
    │── tools/call ────→ │                        │
    │                    │── evaluate policy       │
    │                    │── log audit event       │
    │                    │── tools/call ─────────→ │
    │                    │                        │
    │                    │ ←──── result ────────── │
    │                    │── log result + hash     │
    │ ←──── result ───── │                        │
```

## Architecture

Monorepo with clean package boundaries:

- **@imara/core** — Types, Zod schemas, SHA-256 hash chaining
- **@imara/store** — Audit event storage (SQLite for local, Postgres planned)
- **@imara/policy** — TypeScript-native policy evaluation engine
- **@imara/proxy** — MCP proxy with tool call interception
- **@imara/dashboard** — Next.js web UI with timeline view

## Why Imara?

AI agents are doing real work — reading files, executing code, calling APIs, pushing to git. But most teams have **zero visibility** into what their agents actually do.

Existing tools don't solve this:
- **Observability platforms** (LangSmith, Langfuse) show traces but don't enforce policies
- **Security tools** (Zenity, Lakera) focus on prompt injection, not runtime governance
- **Nothing** provides compliance-grade audit trails for agent actions

Imara fills the gap: runtime governance with cryptographic proof.

### Compliance Ready

Imara's audit trail maps to major compliance frameworks:
- **EU AI Act** Art. 12 (record-keeping) & Art. 14 (human oversight)
- **SOC 2** CC6.1, CC8.1 (change management)
- **HIPAA** audit controls
- **ISO 42001** AI management systems

## Roadmap

- [x] MCP proxy with transparent interception
- [x] SHA-256 hash-chained audit trail
- [x] YAML policy engine with glob matching
- [x] Real-time dashboard with timeline view
- [x] Zero-config `imara wrap` setup
- [ ] Postgres store for team deployments
- [ ] Team mode with multi-user access
- [ ] Compliance report exports (EU AI Act, SOC 2)
- [ ] Human-in-the-loop escalation workflows
- [ ] SSE/WebSocket transport support
- [ ] Docker Compose for server deployment

## Development

```bash
git clone https://github.com/dnakitare/imara.git
cd imara
pnpm install
pnpm build
node packages/cli/dist/cli.js
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).
