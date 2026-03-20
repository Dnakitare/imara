import { z } from 'zod';

export const PolicyDecisionTypeSchema = z.enum(['allow', 'deny', 'escalate']);

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sessionId: z.string(),
  serverName: z.string(),
  agentId: z.string().optional(),
  toolName: z.string(),
  toolArguments: z.record(z.unknown()),
  toolAnnotations: z.record(z.unknown()).optional(),
  policyDecision: PolicyDecisionTypeSchema,
  policyReason: z.string().optional(),
  policiesEvaluated: z.array(z.string()),
  resultStatus: z.enum(['success', 'error', 'blocked']).optional(),
  resultSummary: z.string().optional(),
  resultLatencyMs: z.number().int().nonneg().optional(),
  prevHash: z.string().nullable(),
  eventHash: z.string(),
});

export type AuditEventInput = z.infer<typeof AuditEventSchema>;
