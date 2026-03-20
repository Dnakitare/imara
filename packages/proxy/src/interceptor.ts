import { randomUUID } from 'node:crypto';
import type { AuditEvent, PolicyDecisionType } from '@imara/core';
import { computeEventHash } from '@imara/core';
import type { AuditStore } from '@imara/store';
import type { PolicyEngine } from '@imara/policy';

export interface InterceptorConfig {
  store: AuditStore;
  policyEngine: PolicyEngine;
  serverName: string;
  sessionId: string;
}

export class ToolCallInterceptor {
  private store: AuditStore;
  private policyEngine: PolicyEngine;
  private serverName: string;
  private sessionId: string;

  constructor(config: InterceptorConfig) {
    this.store = config.store;
    this.policyEngine = config.policyEngine;
    this.serverName = config.serverName;
    this.sessionId = config.sessionId;
  }

  evaluatePolicy(toolName: string, args: Record<string, unknown>): {
    decision: PolicyDecisionType;
    reason?: string;
    policiesEvaluated: string[];
  } {
    return this.policyEngine.evaluate({
      toolName,
      serverName: this.serverName,
      arguments: args,
    });
  }

  createAndStoreEvent(params: {
    toolName: string;
    toolArguments: Record<string, unknown>;
    toolAnnotations?: Record<string, unknown>;
    policyDecision: PolicyDecisionType;
    policyReason?: string;
    policiesEvaluated: string[];
    resultStatus?: 'success' | 'error' | 'blocked';
    resultSummary?: string;
    resultLatencyMs?: number;
  }): AuditEvent {
    const prevHash = this.store.getLatestHash();
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const hashableEvent = {
      id,
      timestamp,
      sessionId: this.sessionId,
      serverName: this.serverName,
      toolName: params.toolName,
      toolArguments: params.toolArguments,
      policyDecision: params.policyDecision,
      prevHash,
    };

    const eventHash = computeEventHash(hashableEvent);

    const event: AuditEvent = {
      id,
      timestamp,
      sessionId: this.sessionId,
      serverName: this.serverName,
      toolName: params.toolName,
      toolArguments: params.toolArguments,
      toolAnnotations: params.toolAnnotations,
      policyDecision: params.policyDecision,
      policyReason: params.policyReason,
      policiesEvaluated: params.policiesEvaluated,
      resultStatus: params.resultStatus,
      resultSummary: params.resultSummary,
      resultLatencyMs: params.resultLatencyMs,
      prevHash,
      eventHash,
    };

    this.store.append(event);
    return event;
  }
}
