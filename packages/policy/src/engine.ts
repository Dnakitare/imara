import type { PolicyRule, PolicyAction, ToolMatcher } from '@imara/core';
import type { PolicyDecision } from '@imara/core';
import { matchesTool, matchesArguments } from './matchers.js';

interface ToolCallContext {
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
}

interface RateLimitState {
  key: string;
  timestamps: number[];
}

export class PolicyEngine {
  private rules: PolicyRule[] = [];
  private rateLimitState = new Map<string, RateLimitState>();

  constructor(rules: PolicyRule[] = []) {
    this.setRules(rules);
  }

  setRules(rules: PolicyRule[]): void {
    // Sort by priority (lower number = higher priority)
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
  }

  evaluate(context: ToolCallContext): PolicyDecision {
    const matchedPolicies: string[] = [];
    let finalAction: PolicyAction = 'allow';
    let finalReason: string | undefined;

    for (const rule of this.rules) {
      const toolMatches = rule.match.tools.some(tm =>
        matchesTool(tm, context.toolName, context.serverName)
      );

      if (!toolMatches) continue;

      if (rule.match.arguments && !matchesArguments(rule.match.arguments, context.arguments)) {
        continue;
      }

      matchedPolicies.push(rule.name);

      // Check rate limit if applicable
      if (rule.rateLimit) {
        const exceeded = this.checkRateLimit(rule, context);
        if (exceeded) {
          return {
            decision: 'deny',
            reason: `Rate limit exceeded: ${rule.rateLimit.maxCalls} calls per ${rule.rateLimit.windowSeconds}s (policy: ${rule.name})`,
            policiesEvaluated: matchedPolicies,
          };
        }
      }

      // First matching deny/escalate wins (rules sorted by priority)
      if (rule.action === 'deny' || rule.action === 'escalate') {
        return {
          decision: rule.action,
          reason: rule.reason ?? `Blocked by policy: ${rule.name}`,
          policiesEvaluated: matchedPolicies,
        };
      }

      if (rule.action === 'allow') {
        finalAction = 'allow';
        finalReason = rule.reason;
      }
      // 'log' action doesn't change decision, just records the match
    }

    // Record rate limit hit for allowed calls
    this.recordRateLimitHit(context);

    return {
      decision: finalAction,
      reason: finalReason,
      policiesEvaluated: matchedPolicies,
    };
  }

  private getRateLimitKey(rule: PolicyRule, context: ToolCallContext): string {
    return `${rule.name}:${context.toolName}`;
  }

  private checkRateLimit(rule: PolicyRule, context: ToolCallContext): boolean {
    if (!rule.rateLimit) return false;

    const key = this.getRateLimitKey(rule, context);
    const state = this.rateLimitState.get(key);
    if (!state) return false;

    const now = Date.now();
    const windowStart = now - rule.rateLimit.windowSeconds * 1000;
    const recentCalls = state.timestamps.filter(t => t >= windowStart);

    return recentCalls.length >= rule.rateLimit.maxCalls;
  }

  private recordRateLimitHit(context: ToolCallContext): void {
    const now = Date.now();
    for (const rule of this.rules) {
      if (!rule.rateLimit) continue;
      const toolMatches = rule.match.tools.some(tm =>
        matchesTool(tm, context.toolName, context.serverName)
      );
      if (!toolMatches) continue;

      const key = this.getRateLimitKey(rule, context);
      const state = this.rateLimitState.get(key) ?? { key, timestamps: [] };
      state.timestamps.push(now);

      // Clean old entries
      const windowStart = now - rule.rateLimit.windowSeconds * 1000;
      state.timestamps = state.timestamps.filter(t => t >= windowStart);
      this.rateLimitState.set(key, state);
    }
  }
}
