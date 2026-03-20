export type PolicyAction = 'allow' | 'deny' | 'escalate' | 'log';

export interface ToolMatcher {
  tool: string;         // glob pattern, e.g. "file_*", "send_email"
  server?: string;      // optional server name filter
}

export interface ArgumentMatcher {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'matches' | 'contains';
  value: unknown;
}

export interface RateLimit {
  maxCalls: number;
  windowSeconds: number;
}

export interface PolicyRule {
  name: string;
  description?: string;
  priority: number;       // lower = higher priority
  match: {
    tools: ToolMatcher[];
    arguments?: ArgumentMatcher[];
  };
  action: PolicyAction;
  reason?: string;
  rateLimit?: RateLimit;
  tags?: string[];
  complianceFrameworks?: string[];
}

export interface PolicyConfig {
  version: string;
  policies: PolicyRule[];
}
