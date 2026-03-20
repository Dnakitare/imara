export interface ToolCall {
  id: string;
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export type PolicyDecisionType = 'allow' | 'deny' | 'escalate';

export interface PolicyDecision {
  decision: PolicyDecisionType;
  reason?: string;
  policiesEvaluated: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  serverName: string;
  agentId?: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  toolAnnotations?: Record<string, unknown>;
  policyDecision: PolicyDecisionType;
  policyReason?: string;
  policiesEvaluated: string[];
  resultStatus?: 'success' | 'error' | 'blocked';
  resultSummary?: string;
  resultLatencyMs?: number;
  prevHash: string | null;
  eventHash: string;
}
