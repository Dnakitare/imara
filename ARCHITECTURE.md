# Imara — Agent Trust & Governance Platform

## MVP Architecture Spec (v0.1 — March 2026)

> "The gap between 'agents are doing real work' and 'we can prove what agents did' is wide and growing."

---

## 1. Product Thesis

Imara is a **runtime governance layer** for autonomous AI agents. It sits between agents and the systems they act on, providing:

- **Tamper-proof audit trails** of every agent action
- **Policy enforcement** at the tool-call level (approve, block, escalate)
- **Compliance mapping** to EU AI Act, SOC 2, HIPAA, SR 11-7, ISO 42001
- **Non-technical stakeholder dashboards** for compliance officers, legal, and risk teams

### Why Now

| Signal | Data Point |
|--------|-----------|
| Market size | AI governance market ~$940M (2025), projected $7.4B by 2030 (45.3% CAGR) |
| Enterprise demand | 84% require compliance for agent deployment; only 6% have advanced strategies |
| Budget allocation | 50% of executives plan $10-50M for agent governance in 2026 |
| Regulatory deadline | EU AI Act high-risk requirements enforceable **August 2, 2026** (5 months) |
| Acquisition signal | $1.4B+ in AI security acquisitions in 12 months — but governance layer remains unconsolidated |
| Production multiplier | Companies with AI governance tools ship 12x more AI projects to production |

### Why Not Existing Players

| Player | Gap |
|--------|-----|
| **Zenity** | Security-focused (prompt injection, data leaks). No compliance mapping or regulatory audit trails. Microsoft/Salesforce-locked. |
| **Credo AI** | Model-level governance (bias, fairness). No runtime agent tracing or tool-call monitoring. Documentation-centric, not runtime. |
| **LangSmith/Langfuse/Arize** | Developer observability. No policy enforcement, compliance frameworks, or non-technical user access. |
| **Acquired players** (Protect AI, Lakera, CalypsoAI, Robust Intelligence) | All security-only. All absorbed into platform incumbents. Governance was never their product. |
| **Arthur AI** | Late pivot to agentic governance. No new funding since 2022. Early-stage capabilities. |

**Our position:** Upper-right quadrant — runtime governance + compliance-grade audit — where no product exists today.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IMARA PLATFORM                              │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ Imara    │  │ Policy       │  │ Audit      │  │ Compliance   │ │
│  │ Proxy    │  │ Engine       │  │ Store      │  │ Reporter     │ │
│  │          │  │              │  │            │  │              │ │
│  │ MCP Proxy│  │ OPA/Rego    │  │ Append-only│  │ EU AI Act    │ │
│  │ HTTP Mid │  │ Policy DSL  │  │ OCSF-format│  │ SOC 2        │ │
│  │ SDK Hooks│  │ RBAC Engine │  │ Crypto hash│  │ HIPAA        │ │
│  │          │  │ HITL Router │  │ chain      │  │ SR 11-7      │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬──────┘  └──────┬───────┘ │
│       │               │               │                │          │
│  ┌────┴───────────────┴───────────────┴────────────────┴───────┐  │
│  │                    Event Bus (async)                         │  │
│  │              Action events → Policy decisions → Audit logs   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Dashboard    │  │ Alert        │  │ Identity & Permissions   │ │
│  │ (Web UI)     │  │ Manager      │  │                          │ │
│  │              │  │              │  │ Agent registry            │ │
│  │ Compliance   │  │ Slack/Email  │  │ Capability scoping        │ │
│  │ Risk mgrs   │  │ PagerDuty    │  │ Delegation chains         │ │
│  │ Developers   │  │ Webhooks     │  │ OAuth 2.1 / SPIFFE       │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │ MCP     │         │ HTTP    │         │ SDK     │
    │ Agents  │         │ Agents  │         │ Agents  │
    │         │         │         │         │         │
    │ Claude  │         │ Custom  │         │ LangChn │
    │ Co-work │         │ REST    │         │ CrewAI  │
    │ OpenAI  │         │ agents  │         │ AutoGen │
    └─────────┘         └─────────┘         └─────────┘
```

---

## 3. Core Components (MVP Scope)

### 3.1 Imara Proxy — The Interception Layer

The proxy is the critical technical differentiator. It intercepts agent actions **before they execute** against target systems.

#### 3.1.1 MCP Proxy (Primary — MVP)

MCP is the natural interception point. All tool calls flow as JSON-RPC 2.0 messages with typed schemas.

**How it works:**
1. Imara runs as an **MCP proxy server** — agents connect to Imara instead of directly to MCP tool servers
2. Imara forwards `tools/list` requests to downstream servers, augmenting responses with policy metadata
3. On `tools/call`, Imara intercepts the request, evaluates policy, logs the action, and either forwards, blocks, or escalates

```
Agent Host → Imara MCP Proxy → Policy Engine → [approve/block/escalate]
                                                       │
                                                  ┌────┴────┐
                                                  │ Audit   │
                                                  │ Store   │
                                                  └─────────┘
                                                       │
                                              (if approved)
                                                       │
                                              Downstream MCP Server
```

**MCP interception data available per tool call:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "send_email",           // tool name → policy lookup
    "arguments": {                  // full arguments → content inspection
      "to": "client@example.com",
      "subject": "Q4 Report",
      "body": "..."
    }
  }
}
```

**Plus MCP tool annotations (behavioral hints):**
- `readOnlyHint` — read vs. write operation
- `destructiveHint` — destructive action flag
- `idempotentHint` — safe to retry
- `openWorldHint` — interacts with external systems

These annotations directly inform policy decisions (e.g., "block all destructive actions without approval").

**Implementation:** TypeScript/Node.js MCP server using the official `@modelcontextprotocol/sdk`. Stateless proxy — all state lives in the audit store and policy engine.

#### 3.1.2 HTTP Middleware (Secondary — MVP)

For agents that call tools via REST APIs rather than MCP:

- **Reverse proxy** (similar to Helicone's pattern) — agents change their base URL to route through Imara
- Captures: HTTP method, URL, headers, request/response body, latency, status code
- Zero code changes for agents using standard HTTP clients

**Implementation:** Node.js HTTP proxy with configurable routing rules.

#### 3.1.3 SDK Hooks (Phase 2)

For deeper framework integration:
- **LangChain/LangGraph:** `wrap_tool_call` middleware — full access to tool name, arguments, ability to block/modify
- **OpenAI Agents SDK:** Custom `TracingProcessor` — receives all span events
- **Python decorator:** `@imara.monitor` for custom agent code

### 3.2 Policy Engine

Determines what agents can and cannot do. This is where governance becomes actionable.

#### Policy Evaluation Flow

```
Tool Call Intercepted
        │
        ▼
┌─────────────────┐
│ Agent Identity   │──→ Who is this agent? What role?
│ Resolution       │    What user delegated to it?
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Policy Lookup    │──→ What rules apply to this agent + tool + context?
│                  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────┐
│ Policy           │────→│ ALLOW    │──→ Forward to target, log
│ Evaluation       │     ├──────────┤
│                  │────→│ DENY     │──→ Block, log, alert
│ (OPA/Rego)       │     ├──────────┤
│                  │────→│ ESCALATE │──→ Route to human approver (HITL)
│                  │     ├──────────┤
│                  │────→│ REDACT   │──→ Strip sensitive fields, forward
└─────────────────┘     └──────────┘
```

#### Policy Language (MVP)

Use **Open Policy Agent (OPA)** with Rego for the core engine. OPA is battle-tested, has massive enterprise adoption, and integrates with existing infrastructure.

On top of OPA, provide a **simplified YAML DSL** for common patterns so non-engineers can write policies:

```yaml
# Example: Financial services agent policies
policies:
  - name: "block-external-email-without-approval"
    description: "Require human approval for outbound client emails"
    match:
      tool: "send_email"
      agent_role: "financial_advisor_agent"
      arguments:
        to: { not_domain: "@internal.company.com" }
    action: escalate
    escalation:
      channel: slack
      approvers: ["compliance-team"]
      timeout: 30m
      on_timeout: deny

  - name: "block-phi-access-without-baa"
    description: "Deny PHI access unless BAA is on file"
    match:
      tool: "query_patient_records"
      context:
        baa_status: { not: "active" }
    action: deny
    alert:
      severity: critical
      message: "Agent attempted PHI access without active BAA"

  - name: "rate-limit-trading-actions"
    description: "Cap autonomous trading to 50 actions per hour"
    match:
      tool_pattern: "execute_trade*"
    action: allow
    constraints:
      rate_limit:
        max: 50
        window: 1h
        on_exceed: deny

  - name: "redact-pii-in-logging"
    description: "Strip PII from audit logs"
    match:
      tool: "*"
    transforms:
      redact_fields: ["ssn", "credit_card", "date_of_birth"]
```

The YAML compiles down to Rego policies. Power users can write Rego directly.

#### Human-in-the-Loop (HITL) Router

For escalated actions:
- Routes approval requests to **Slack**, **email**, **MS Teams**, or **web dashboard**
- Supports **approval chains** (e.g., compliance officer → legal → execute)
- Configurable **timeouts** with default-deny
- **Audit trail** includes: who approved, when, what context they had
- Future: OpenID CIBA integration for out-of-band confirmation

### 3.3 Audit Store

The immutable record of everything agents do. This is the product's core asset.

#### Event Schema (OCSF-aligned)

Every agent action produces an **Imara Event Record**:

```json
{
  "event_id": "evt_a8f3b2c1",
  "timestamp": "2026-03-19T14:32:01.847Z",
  "event_type": "tool_call",
  "type_uid": 600301,

  "agent": {
    "id": "agent_financial_advisor_7",
    "name": "Q4 Report Generator",
    "model": "claude-opus-4-6",
    "framework": "langchain",
    "session_id": "sess_x9k2m",
    "delegation_chain": ["user:daniel@company.com", "agent:orchestrator_1"]
  },

  "action": {
    "tool_name": "send_email",
    "tool_server": "gmail-mcp-server",
    "arguments": {
      "to": "client@example.com",
      "subject": "Q4 Report",
      "body": "[REDACTED — PII policy applied]"
    },
    "annotations": {
      "readOnly": false,
      "destructive": false,
      "openWorld": true
    }
  },

  "policy": {
    "evaluated_policies": ["block-external-email-without-approval"],
    "decision": "escalate",
    "decision_reason": "External email requires compliance approval",
    "escalation": {
      "approver": "jane@company.com",
      "approved_at": "2026-03-19T14:33:12.003Z",
      "approval_context": "Reviewed email content, approved for Q4 distribution"
    }
  },

  "result": {
    "status": "success",
    "response_summary": "Email sent successfully",
    "latency_ms": 1243
  },

  "compliance": {
    "frameworks": ["SOC2-CC7", "SEC-17a4", "FINRA-4511"],
    "data_classification": "confidential",
    "retention_required_until": "2032-03-19"
  },

  "integrity": {
    "previous_event_hash": "sha256:a1b2c3d4...",
    "event_hash": "sha256:e5f6g7h8..."
  }
}
```

#### Storage Architecture

```
Hot tier (0-30 days):   PostgreSQL — fast queries, dashboard serving
Warm tier (30-365 days): S3 + Parquet — cost-effective, queryable via Athena/DuckDB
Cold tier (1-7 years):  S3 Glacier + Object Lock (WORM) — regulatory retention
```

- **Cryptographic hash chaining** — each event includes hash of previous event (CloudTrail pattern). Tamper-evident without blockchain complexity.
- **S3 Object Lock in Compliance mode** — even root cannot delete within retention window. Satisfies SEC Rule 17a-4 WORM requirement.
- **OCSF event format** — native compatibility with AWS Security Lake, Datadog, Splunk, Microsoft Sentinel for SIEM integration.

### 3.4 Compliance Reporter

Translates raw audit data into regulator-ready evidence.

#### MVP Compliance Packs

| Framework | What Imara Generates | Regulatory Citation |
|-----------|---------------------|---------------------|
| **EU AI Act** | Automatic logging of agent operations, human oversight evidence, transparency records | Art. 12 (Record-keeping), Art. 14 (Human oversight) |
| **SOC 2** | Agent access logs, change management evidence, monitoring reports, incident records | CC6 (Access), CC7 (Operations), CC8 (Change Mgmt) |
| **HIPAA** | PHI access audit trail, minimum necessary enforcement evidence, BAA compliance | 45 CFR 164.312(b), 164.308(a)(1)(ii)(D) |
| **SR 11-7** | Model/agent validation records, ongoing monitoring evidence, governance documentation | OCC/Fed SR 11-7 |
| **ISO 42001** | AI management system evidence, risk assessment records, lifecycle documentation | ISO/IEC 42001:2023 |

**Output formats:** PDF reports, CSV evidence exports, API for GRC tool integration (ServiceNow, OneTrust, Vanta, Drata).

### 3.5 Dashboard (Web UI)

Three personas, three views:

#### Developer View
- Real-time agent trace viewer (OpenTelemetry-compatible)
- Tool call timeline with latency, token usage, model routing
- Policy violation debugger — see which policy blocked/escalated and why
- SDK integration guides

#### Compliance Officer View
- Compliance posture dashboard — % of agent actions covered by policy
- Gap analysis — which agents/tools lack policy coverage
- Evidence package generator — one-click export for auditors
- Regulation deadline tracker (EU AI Act countdown)

#### Risk Manager View
- Agent risk heatmap — which agents perform highest-risk actions
- Anomaly detection — unusual patterns in agent behavior
- Incident timeline — drill from alert → event → full action chain
- Delegation chain visualizer — trace authority from user → agent → sub-agent → action

### 3.6 Agent Identity & Permissions (MVP-lite)

Full AIMS/SPIFFE implementation is Phase 2. For MVP:

- **Agent Registry** — each agent gets an `imara_agent_id` with metadata (name, owner, model, purpose, authorized tools)
- **Capability Scoping** — define which tools each agent can access, with what argument constraints
- **Delegation Tracking** — record the user or system that authorized the agent to act
- **API Key Authentication** — agents authenticate to Imara proxy via API key (maps to agent identity). Upgrade to OAuth 2.1 / SPIFFE in Phase 2.

---

## 4. Technology Stack (MVP)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **MCP Proxy** | TypeScript, `@modelcontextprotocol/sdk` | Official SDK, MCP is JSON-RPC over stdio/HTTP — TS is the best-supported runtime |
| **HTTP Proxy** | Node.js, `http-proxy` | Lightweight, battle-tested reverse proxy |
| **Policy Engine** | Open Policy Agent (OPA) + custom YAML→Rego compiler | OPA has massive enterprise adoption, Rego is expressive, YAML is accessible |
| **API Server** | TypeScript, Hono (or Fastify) | Fast, lightweight, good TypeScript support |
| **Audit Store** | PostgreSQL (hot) + S3 (warm/cold) | Postgres for queries, S3 for immutable retention |
| **Event Bus** | Redis Streams (MVP) → Kafka (scale) | Redis Streams is simple, ordered, persistent. Kafka when volume demands it |
| **Dashboard** | Next.js + Tailwind | Fast to build, SSR for performance, good component ecosystem |
| **HITL Notifications** | Slack API, SendGrid, webhooks | Where compliance teams already live |
| **Telemetry Export** | OpenTelemetry SDK | Standard export to any OTel-compatible backend |
| **Infrastructure** | Docker Compose (dev) → AWS ECS/EKS (prod) | Simple local dev, scalable production |

---

## 5. MVP Scope — What Ships First

### Phase 1: "Prove the Audit Trail" (Weeks 1-6)

Ship the minimum product that a compliance officer can point to and say "this proves what our agents did."

**Build:**
- [ ] MCP proxy server — intercepts `tools/call`, logs every action
- [ ] PostgreSQL audit store with hash-chaining
- [ ] Basic policy engine — allow/deny/escalate per tool per agent
- [ ] YAML policy configuration
- [ ] Web dashboard — event timeline, search, filter
- [ ] Slack integration for HITL approvals
- [ ] Single compliance pack (EU AI Act Art. 12 + Art. 14)
- [ ] Agent registry (manual registration via API)

**Skip (for now):**
- HTTP proxy (MCP-first)
- SDK hooks (MCP-first)
- Advanced analytics / anomaly detection
- SIEM export
- SPIFFE / OAuth agent identity
- Cold storage tiering
- Multi-tenancy

**Target customer:** A single design partner — regulated enterprise (financial services or healthcare) actively deploying Claude/GPT agents via MCP.

### Phase 2: "Policy Power" (Weeks 7-12)

- [ ] Full OPA integration with custom Rego policies
- [ ] HTTP reverse proxy for non-MCP agents
- [ ] Additional compliance packs (SOC 2, HIPAA)
- [ ] Evidence export (PDF reports, CSV)
- [ ] GRC tool integration (Vanta/Drata API)
- [ ] Multi-agent delegation chain tracking
- [ ] Anomaly detection (statistical baselines)
- [ ] S3 warm/cold storage tiering

### Phase 3: "Platform" (Weeks 13-20)

- [ ] SDK hooks (LangChain, OpenAI Agents SDK)
- [ ] OAuth 2.1 agent identity
- [ ] OpenTelemetry export
- [ ] OCSF-formatted SIEM export
- [ ] Multi-tenancy
- [ ] Role-based dashboard access
- [ ] Policy simulation/testing environment
- [ ] A2A protocol support

---

## 6. Revenue Model

| Tier | Price | Target | Includes |
|------|-------|--------|----------|
| **Developer** | Free | Individual builders | 10K events/mo, 7-day retention, 1 agent, community support |
| **Team** | $500/mo | Startups, small teams | 500K events/mo, 90-day retention, 25 agents, Slack HITL, 1 compliance pack |
| **Enterprise** | $5,000+/mo | Regulated enterprises | Unlimited events, 7-year retention, unlimited agents, all compliance packs, SSO, dedicated support, SLA |
| **Compliance Add-ons** | $1,000/mo each | Regulated verticals | HIPAA pack, SOX pack, SR 11-7 pack, ISO 42001 pack |

**Unit economics:** Usage-based on events ingested. Compliance packs are high-margin recurring revenue tied to regulatory requirements (very low churn — you can't un-regulate yourself).

---

## 7. Go-to-Market

### Beachhead: Financial Services

**Why:**
- Highest regulatory pressure (SR 11-7, SEC 17a-4, FINRA 4511)
- Largest budgets for compliance tooling
- Already deploying agents for research, analysis, trading support
- Communication archiving requirements create immediate, concrete demand
- Fines for non-compliance are severe ($2B+ in SEC recordkeeping fines since 2021)

**Entry point:** "Can you prove what your AI agents did with client data? Can you produce that evidence for your next audit?"

### Design Partner Criteria

- Regulated industry (finance, healthcare, legal)
- Already deploying AI agents in production (or within 90 days of deployment)
- Using MCP-compatible agents (Claude, OpenAI with MCP support)
- Has a compliance officer or risk manager who will champion the product
- Willing to provide feedback weekly

### Positioning

**Not:** "AI security" (crowded, getting acquired by platform incumbents)
**Not:** "AI observability" (developer-only, no compliance buyer)
**Is:** "The compliance infrastructure for the agent era"

Tagline candidates:
- "Prove what your agents did."
- "Governance that agents call through."
- "The audit trail for autonomous AI."

---

## 8. Competitive Moats (Why This Survives)

1. **Audit data compounds** — The longer Imara runs, the more historical evidence it accumulates. Ripping it out means losing your compliance history. This is the same switching cost pattern as Datadog.

2. **Regulatory lock-in** — Once a compliance officer certifies their audit process against Imara, changing systems means re-certification. Nobody switches compliance tools for fun.

3. **Agent-agnostic by design** — Works across all agent providers. Not competing with any model provider. Model providers are customers (they need governance for their enterprise customers).

4. **Conflict of interest moat** — Enterprises cannot rationally ask their model provider to audit their own agents. The auditor must be independent. This is why accounting firms exist.

5. **Policy corpus as IP** — Over time, the library of industry-specific policies (HIPAA agent policies, trading compliance policies, legal privilege policies) becomes a knowledge asset that's hard to replicate.

---

## 9. Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Model providers build governance into their platforms | Medium | High | Stay agent-agnostic. Multi-provider governance is inherently a third-party job. No provider will govern competitors' agents. |
| MCP doesn't become the dominant protocol | Low | High | Also support HTTP proxy and SDK hooks. MCP has OpenAI + Anthropic + Google backing via AAIF. |
| Enterprise sales cycles are too long | High | Medium | Start with dev-friendly free tier. Bottom-up adoption by engineering teams, then expand to compliance buyer. |
| OPA adds latency to agent workflows | Medium | Medium | Policy evaluation is typically <5ms. Cache policy decisions. Async logging (don't block on audit write). |
| Regulatory landscape shifts (US deregulation) | Medium | Low | EU AI Act is already law. HIPAA/SEC/FINRA requirements are independent of administration. Focus on international + sector-specific regs. |
| Competitor raises large round and moves fast | Medium | Medium | Ship fast. First-mover in compliance-grade agent audit has 12-18 month advantage due to design partner relationships and policy corpus. |

---

## 10. Open Questions for Design Partners

1. What agents are you deploying today? What frameworks/protocols?
2. What is your current audit process for agent actions? (Likely: none, or manual log review)
3. Which compliance framework is your most urgent priority?
4. Who internally would need to approve agent actions? What's the approval workflow?
5. What's your timeline for the next regulatory audit?
6. Would you deploy Imara as SaaS, or do you need on-prem/VPC deployment?
7. What SIEM/GRC tools do you currently use?
8. What would make you confident enough to expand agent deployment?

---

## Appendix A: Standards & Protocols Referenced

| Standard | Version | Relevance |
|----------|---------|-----------|
| Model Context Protocol (MCP) | 2025-11-25 | Primary interception protocol |
| Google Agent-to-Agent (A2A) | 0.3 | Future agent discovery/governance |
| OpenTelemetry GenAI Semantic Conventions | Development | Telemetry schema |
| OCSF (Open Cybersecurity Schema Framework) | 1.x | Audit event format |
| IETF AIMS (draft-klrc-aiagent-auth-00) | Draft, March 2026 | Agent identity framework |
| Open Policy Agent (OPA) | 1.x | Policy evaluation engine |
| EU AI Act (Reg. 2024/1689) | Final | Compliance target |
| NIST AI RMF (AI 100-1) | 1.0 | Risk management framework |
| ISO/IEC 42001 | 2023 | AI management system standard |
| HIPAA Security Rule | 45 CFR 164.3xx | Healthcare compliance |
| SR 11-7 | 2011 | Financial model risk management |

## Appendix B: Competitive Positioning Map

```
                    SECURITY-FOCUSED              GOVERNANCE-FOCUSED
                    (Threats/Attacks)              (Policy/Compliance/Audit)

RUNTIME         │  Zenity ($59.5M)             │                          │
(Agent Actions) │  Cisco (Robust Intelligence)  │  ★ IMARA ★              │
                │  Check Point (Lakera)         │                          │
                │  F5 (CalypsoAI)               │  Credo AI (model-level)  │
                │  NVIDIA OpenShell (OSS)       │  Arthur AI (early)       │

PRE-DEPLOYMENT  │  Patronus AI                 │  Credo AI                 │
(Testing/Eval)  │  Guardrails AI               │                          │

OBSERVABILITY   │  Braintrust ($80M)           │                          │
(Traces/Evals)  │  Arize, LangSmith, Langfuse  │                          │
                │  Maxim, Helicone, AgentOps    │                          │
```
