import { describe, it, expect } from 'vitest';
import { computeEventHash, verifyChain, type HashableEvent, type VerifiableEvent } from '../hash.js';

function makeEvent(overrides: Partial<HashableEvent> = {}): HashableEvent {
  return {
    id: 'evt-001',
    timestamp: '2026-03-27T00:00:00.000Z',
    sessionId: 'sess-1',
    serverName: 'test-server',
    toolName: 'read_file',
    toolArguments: { path: '/tmp/test.txt' },
    policyDecision: 'allow',
    prevHash: null,
    ...overrides,
  };
}

describe('computeEventHash', () => {
  it('returns a 64-char hex SHA-256 hash', () => {
    const hash = computeEventHash(makeEvent());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const event = makeEvent();
    expect(computeEventHash(event)).toBe(computeEventHash(event));
  });

  it('changes when any field changes', () => {
    const base = computeEventHash(makeEvent());
    const fields: (keyof HashableEvent)[] = [
      'id', 'timestamp', 'sessionId', 'serverName',
      'toolName', 'policyDecision',
    ];

    for (const field of fields) {
      const modified = computeEventHash(makeEvent({ [field]: 'changed' }));
      expect(modified).not.toBe(base);
    }
  });

  it('changes when toolArguments change', () => {
    const base = computeEventHash(makeEvent());
    const modified = computeEventHash(makeEvent({ toolArguments: { path: '/other' } }));
    expect(modified).not.toBe(base);
  });

  it('changes when prevHash changes', () => {
    const base = computeEventHash(makeEvent({ prevHash: null }));
    const modified = computeEventHash(makeEvent({ prevHash: 'abc123' }));
    expect(modified).not.toBe(base);
  });

  it('changes when new fields change (agentId, annotations, resultStatus, policiesEvaluated)', () => {
    const base = computeEventHash(makeEvent());
    expect(computeEventHash(makeEvent({ agentId: 'agent-1' }))).not.toBe(base);
    expect(computeEventHash(makeEvent({ toolAnnotations: { readOnly: true } }))).not.toBe(base);
    expect(computeEventHash(makeEvent({ resultStatus: 'error' }))).not.toBe(base);
    expect(computeEventHash(makeEvent({ policiesEvaluated: ['block-writes'] }))).not.toBe(base);
  });

  it('uses deterministic serialization (array-based, not object key order)', () => {
    // Two calls with the same data must always produce the same hash
    const event = makeEvent({ agentId: 'a1', policiesEvaluated: ['p1', 'p2'] });
    const h1 = computeEventHash(event);
    const h2 = computeEventHash({ ...event });
    expect(h1).toBe(h2);
  });

  it('hashes nested arguments equally regardless of key order (canonicalized)', () => {
    const a = computeEventHash(makeEvent({ toolArguments: { branch: 'main', force: true } }));
    const b = computeEventHash(makeEvent({ toolArguments: { force: true, branch: 'main' } }));
    expect(a).toBe(b);
  });
});

describe('verifyChain', () => {
  function buildChain(count: number): VerifiableEvent[] {
    const chain: VerifiableEvent[] = [];
    for (let i = 0; i < count; i++) {
      const event = makeEvent({
        id: `evt-${i}`,
        timestamp: `2026-03-27T00:00:0${i}.000Z`,
        prevHash: i > 0 ? chain[i - 1].eventHash : null,
      });
      const eventHash = computeEventHash(event);
      chain.push({ ...event, eventHash });
    }
    return chain;
  }

  it('validates a correct single-event chain', () => {
    expect(verifyChain(buildChain(1))).toEqual({ valid: true });
  });

  it('validates a correct multi-event chain', () => {
    expect(verifyChain(buildChain(5))).toEqual({ valid: true });
  });

  it('returns valid for an empty chain', () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it('detects a tampered event hash', () => {
    const chain = buildChain(3);
    chain[1].eventHash = 'tampered';
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('detects a tampered field even when the stored hash is left unchanged', () => {
    const chain = buildChain(3);
    chain[1].toolName = 'rm_rf'; // mutate content, keep old eventHash
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('detects a broken chain link (wrong prevHash)', () => {
    const chain = buildChain(3);
    chain[2] = { ...chain[2], prevHash: 'wrong-link' };
    chain[2].eventHash = computeEventHash(chain[2]);
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });

  it('detects a deleted prefix via the genesis anchor', () => {
    const chain = buildChain(4);
    const truncated = chain.slice(1); // drop the real genesis
    const result = verifyChain(truncated);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.reason).toMatch(/genesis/i);
  });

  it('detects end-truncation against a recorded head anchor', () => {
    const chain = buildChain(5);
    const head = chain[4].eventHash;
    const result = verifyChain(chain.slice(0, 4), { expectedHead: head });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/head/i);
  });

  it('detects a count mismatch against a recorded count', () => {
    const chain = buildChain(5);
    const result = verifyChain(chain.slice(0, 4), { expectedCount: 5 });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/count/i);
  });

  it('passes when head and count anchors match', () => {
    const chain = buildChain(5);
    const result = verifyChain(chain, {
      expectedHead: chain[4].eventHash,
      expectedCount: 5,
    });
    expect(result).toEqual({ valid: true });
  });
});
