import { describe, it, expect } from 'vitest';
import { AuditEventSchema, PolicyDecisionTypeSchema } from '../schemas/event.schema.js';
import { PolicyRuleSchema, PolicyConfigSchema, ToolMatcherSchema, RateLimitSchema } from '../schemas/policy.schema.js';

describe('PolicyDecisionTypeSchema', () => {
  it('accepts valid decisions', () => {
    expect(PolicyDecisionTypeSchema.parse('allow')).toBe('allow');
    expect(PolicyDecisionTypeSchema.parse('deny')).toBe('deny');
    expect(PolicyDecisionTypeSchema.parse('escalate')).toBe('escalate');
  });

  it('rejects invalid decisions', () => {
    expect(() => PolicyDecisionTypeSchema.parse('block')).toThrow();
    expect(() => PolicyDecisionTypeSchema.parse('')).toThrow();
  });
});

describe('AuditEventSchema', () => {
  const validHash = 'a'.repeat(64);
  const validEvent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2026-03-27T00:00:00.000Z',
    sessionId: 'sess-1',
    serverName: 'test-server',
    toolName: 'read_file',
    toolArguments: { path: '/tmp/test.txt' },
    policyDecision: 'allow',
    policiesEvaluated: ['log-all'],
    prevHash: null,
    eventHash: validHash,
  };

  it('accepts a valid event', () => {
    expect(() => AuditEventSchema.parse(validEvent)).not.toThrow();
  });

  it('rejects non-hex eventHash', () => {
    expect(() => AuditEventSchema.parse({ ...validEvent, eventHash: 'abc123' })).toThrow();
  });

  it('rejects too-long sessionId', () => {
    expect(() => AuditEventSchema.parse({ ...validEvent, sessionId: 'x'.repeat(257) })).toThrow();
  });

  it('accepts optional fields', () => {
    const full = {
      ...validEvent,
      agentId: 'agent-1',
      toolAnnotations: { readOnly: true },
      policyReason: 'Allowed by default',
      resultStatus: 'success',
      resultSummary: 'File read OK',
      resultLatencyMs: 42,
    };
    expect(() => AuditEventSchema.parse(full)).not.toThrow();
  });

  it('rejects non-UUID id', () => {
    expect(() => AuditEventSchema.parse({ ...validEvent, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects invalid policyDecision', () => {
    expect(() => AuditEventSchema.parse({ ...validEvent, policyDecision: 'block' })).toThrow();
  });

  it('rejects negative latency', () => {
    expect(() => AuditEventSchema.parse({ ...validEvent, resultLatencyMs: -1 })).toThrow();
  });

  it('rejects invalid resultStatus', () => {
    expect(() => AuditEventSchema.parse({ ...validEvent, resultStatus: 'timeout' })).toThrow();
  });
});

describe('PolicyRuleSchema', () => {
  const validRule = {
    name: 'block-writes',
    priority: 10,
    match: { tools: [{ tool: 'write_*' }] },
    action: 'deny',
  };

  it('accepts a valid rule', () => {
    expect(() => PolicyRuleSchema.parse(validRule)).not.toThrow();
  });

  it('accepts all optional fields', () => {
    const full = {
      ...validRule,
      description: 'Block write operations',
      reason: 'Writes disabled',
      rateLimit: { maxCalls: 10, windowSeconds: 60 },
      tags: ['security'],
      complianceFrameworks: ['SOC2'],
    };
    expect(() => PolicyRuleSchema.parse(full)).not.toThrow();
  });

  it('rejects empty tools array', () => {
    expect(() => PolicyRuleSchema.parse({
      ...validRule,
      match: { tools: [] },
    })).toThrow();
  });

  it('rejects invalid action', () => {
    expect(() => PolicyRuleSchema.parse({ ...validRule, action: 'reject' })).toThrow();
  });
});

describe('ToolMatcherSchema', () => {
  it('accepts tool only', () => {
    expect(() => ToolMatcherSchema.parse({ tool: 'read_*' })).not.toThrow();
  });

  it('accepts tool + server', () => {
    expect(() => ToolMatcherSchema.parse({ tool: 'read_*', server: 'fs-server' })).not.toThrow();
  });
});

describe('RateLimitSchema', () => {
  it('accepts valid rate limit', () => {
    expect(() => RateLimitSchema.parse({ maxCalls: 10, windowSeconds: 60 })).not.toThrow();
  });

  it('rejects zero maxCalls', () => {
    expect(() => RateLimitSchema.parse({ maxCalls: 0, windowSeconds: 60 })).toThrow();
  });

  it('rejects negative windowSeconds', () => {
    expect(() => RateLimitSchema.parse({ maxCalls: 10, windowSeconds: -1 })).toThrow();
  });
});

describe('PolicyConfigSchema', () => {
  it('accepts valid config', () => {
    expect(() => PolicyConfigSchema.parse({
      version: '1.0',
      policies: [{
        name: 'test',
        priority: 1,
        match: { tools: [{ tool: '*' }] },
        action: 'log',
      }],
    })).not.toThrow();
  });
});
