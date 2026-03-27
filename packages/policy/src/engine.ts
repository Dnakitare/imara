import type { PolicyRule, PolicyAction, ToolMatcher } from '@imara/core';
import type { PolicyDecision } from '@imara/core';
import { matchesTool, matchesArguments } from './matchers.js';

interface ToolCallContext {
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
}

interface RateLimitState {
  timestamps: number[];
  lastAccess: number;
}

const MAX_RATE_LIMIT_ENTRIES = 10000;

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

      // Check rate limit if applicable — record hit BEFORE checking
      // so the first call counts toward the limit
      if (rule.rateLimit) {
        this.recordRateLimitHit(rule, context);
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

    // Record rate limit hit for allowed calls (for rules without rateLimit
    // that still need tracking, this is a no-op since we skip non-rateLimit rules)
    this.recordAllowedRateLimitHits(context);

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

    return recentCalls.length > rule.rateLimit.maxCalls;
  }

  private recordRateLimitHit(rule: PolicyRule, context: ToolCallContext): void {
    if (!rule.rateLimit) return;

    const now = Date.now();
    const key = this.getRateLimitKey(rule, context);
    const state = this.rateLimitState.get(key) ?? { timestamps: [], lastAccess: now };
    state.timestamps.push(now);
    state.lastAccess = now;

    // Clean old entries within this bucket
    const windowStart = now - rule.rateLimit.windowSeconds * 1000;
    state.timestamps = state.timestamps.filter(t => t >= windowStart);
    this.rateLimitState.set(key, state);

    // Evict stale entries if map is too large
    this.evictStaleEntries();
  }

  /** Record hits for rate-limited rules that matched but weren't the deciding rule. */
  private recordAllowedRateLimitHits(context: ToolCallContext): void {
    for (const rule of this.rules) {
      if (!rule.rateLimit) continue;
      const toolMatches = rule.match.tools.some(tm =>
        matchesTool(tm, context.toolName, context.serverName)
      );
      if (!toolMatches) continue;

      // Only record if we haven't already (rules with rateLimit record during evaluate)
      const key = this.getRateLimitKey(rule, context);
      const state = this.rateLimitState.get(key);
      if (!state) {
        // First time seeing this key from an allowed path
        this.recordRateLimitHit(rule, context);
      }
    }
  }

  private evictStaleEntries(): void {
    if (this.rateLimitState.size <= MAX_RATE_LIMIT_ENTRIES) return;

    // Evict entries with empty timestamps or oldest lastAccess
    const entries = [...this.rateLimitState.entries()]
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toRemove = entries.slice(0, entries.length - MAX_RATE_LIMIT_ENTRIES);
    for (const [key] of toRemove) {
      this.rateLimitState.delete(key);
    }
  }
}
