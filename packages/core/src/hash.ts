import { createHash } from 'node:crypto';

export interface HashableEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  serverName: string;
  agentId?: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  toolAnnotations?: Record<string, unknown>;
  policyDecision: string;
  policiesEvaluated?: string[];
  resultStatus?: string;
  prevHash: string | null;
}

/**
 * Compute a SHA-256 hash of an audit event.
 * Uses explicit key ordering to ensure deterministic serialization.
 */
export function computeEventHash(event: HashableEvent): string {
  // Explicit key ordering for deterministic hashing across environments
  const payload = JSON.stringify([
    event.id,
    event.timestamp,
    event.sessionId,
    event.serverName,
    event.agentId ?? null,
    event.toolName,
    event.toolArguments,
    event.toolAnnotations ?? null,
    event.policyDecision,
    event.policiesEvaluated ?? [],
    event.resultStatus ?? null,
    event.prevHash,
  ]);
  return createHash('sha256').update(payload).digest('hex');
}

export function verifyChain(events: HashableEvent[]): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedHash = computeEventHash(event);

    // Verify hash matches (event must carry its own hash for comparison)
    if ('eventHash' in event && (event as any).eventHash !== expectedHash) {
      return { valid: false, brokenAt: i };
    }

    // Verify chain linkage (skip first event)
    if (i > 0) {
      const prevEvent = events[i - 1];
      const prevHash = 'eventHash' in prevEvent ? (prevEvent as any).eventHash : computeEventHash(prevEvent);
      if (event.prevHash !== prevHash) {
        return { valid: false, brokenAt: i };
      }
    }
  }
  return { valid: true };
}
