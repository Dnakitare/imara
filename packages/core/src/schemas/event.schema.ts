import { z } from 'zod';

const hexHash = z.string().regex(/^[a-f0-9]{64}$/);

export const PolicyDecisionTypeSchema = z.enum(['allow', 'deny', 'escalate']);

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1).max(256),
  serverName: z.string().min(1).max(256),
  agentId: z.string().max(256).optional(),
  toolName: z.string().min(1).max(512),
  toolArguments: z.record(z.unknown()),
  toolAnnotations: z.record(z.unknown()).optional(),
  policyDecision: PolicyDecisionTypeSchema,
  policyReason: z.string().max(2000).optional(),
  policiesEvaluated: z.array(z.string().max(256)),
  resultStatus: z.enum(['success', 'error', 'blocked']).optional(),
  resultSummary: z.string().max(4000).optional(),
  resultLatencyMs: z.number().int().nonnegative().optional(),
  prevHash: hexHash.nullable(),
  eventHash: hexHash,
});

export type AuditEventInput = z.infer<typeof AuditEventSchema>;
