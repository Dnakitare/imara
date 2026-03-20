import { z } from 'zod';

export const ToolMatcherSchema = z.object({
  tool: z.string(),
  server: z.string().optional(),
});

export const ArgumentMatcherSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'in', 'not_in', 'matches', 'contains']),
  value: z.unknown(),
});

export const RateLimitSchema = z.object({
  maxCalls: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
});

export const PolicyRuleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priority: z.number().int(),
  match: z.object({
    tools: z.array(ToolMatcherSchema).min(1),
    arguments: z.array(ArgumentMatcherSchema).optional(),
  }),
  action: z.enum(['allow', 'deny', 'escalate', 'log']),
  reason: z.string().optional(),
  rateLimit: RateLimitSchema.optional(),
  tags: z.array(z.string()).optional(),
  complianceFrameworks: z.array(z.string()).optional(),
});

export const PolicyConfigSchema = z.object({
  version: z.string(),
  policies: z.array(PolicyRuleSchema),
});
