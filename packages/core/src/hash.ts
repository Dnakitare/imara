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

/** An event that carries the hash committed at append time. verifyChain requires this. */
export type VerifiableEvent = HashableEvent & { eventHash: string };

export interface VerifyOptions {
  /**
   * The last-known-good head hash, recorded out of band (e.g. an anchor file or
   * off-host). If supplied, the chain's final hash must equal it — this is what
   * makes truncation or wholesale rewrite detectable, which the chain alone cannot do.
   */
  expectedHead?: string | null;
  /** The last-known-good event count. If supplied, the chain length must match. */
  expectedCount?: number;
}

export interface VerifyResult {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
}

/**
 * Recursively sort object keys so semantically equal payloads hash identically
 * regardless of key insertion order. Arrays keep their order (order is meaningful).
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Compute a SHA-256 hash of an audit event.
 * Top-level fields are serialized in a fixed order and nested objects are
 * canonicalized (keys sorted), so the same logical event always hashes the same.
 */
export function computeEventHash(event: HashableEvent): string {
  const payload = JSON.stringify([
    event.id,
    event.timestamp,
    event.sessionId,
    event.serverName,
    event.agentId ?? null,
    event.toolName,
    canonicalize(event.toolArguments),
    event.toolAnnotations ? canonicalize(event.toolAnnotations) : null,
    event.policyDecision,
    event.policiesEvaluated ?? [],
    event.resultStatus ?? null,
    event.prevHash,
  ]);
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify a hash chain in append order.
 *
 * Each event must carry the `eventHash` committed when it was stored; the function
 * recomputes that hash and rejects any mismatch, so a verifier cannot be fooled by
 * passing events without their stored hashes. The chain is anchored at the genesis
 * event (its prevHash must be null), which detects deletion of a prefix. End-truncation
 * and wholesale rewrite are only detectable against an out-of-band anchor, supplied via
 * `opts.expectedHead` / `opts.expectedCount`.
 */
export function verifyChain(events: VerifiableEvent[], opts: VerifyOptions = {}): VerifyResult {
  if (opts.expectedCount !== undefined && events.length !== opts.expectedCount) {
    return {
      valid: false,
      reason: `Event count mismatch: expected ${opts.expectedCount}, found ${events.length} (events added or removed)`,
    };
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Genesis must be anchored — a non-null prevHash on the first event means a
    // prefix of the chain was removed.
    if (i === 0 && event.prevHash !== null) {
      return { valid: false, brokenAt: 0, reason: 'Genesis event is not anchored (prevHash is not null)' };
    }

    // The stored hash must match a recompute of the event's contents.
    if (event.eventHash !== computeEventHash(event)) {
      return { valid: false, brokenAt: i, reason: 'Event hash does not match its contents (tampered)' };
    }

    // Linkage: each event must point at the previous event's stored hash.
    if (i > 0 && event.prevHash !== events[i - 1].eventHash) {
      return { valid: false, brokenAt: i, reason: 'Broken chain linkage (prevHash mismatch)' };
    }
  }

  if (opts.expectedHead !== undefined) {
    const head = events.length > 0 ? events[events.length - 1].eventHash : null;
    if (head !== opts.expectedHead) {
      return { valid: false, reason: 'Head hash does not match the recorded anchor (truncated or rewritten)' };
    }
  }

  return { valid: true };
}
