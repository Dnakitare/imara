import { describe, it, expect } from 'vitest';
import { computeEventHash, verifyChain, type HashableEvent } from '../hash.js';

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
});

describe('verifyChain', () => {
  function buildChain(count: number): (HashableEvent & { eventHash: string })[] {
    const chain: (HashableEvent & { eventHash: string })[] = [];
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
    const chain = buildChain(1);
    expect(verifyChain(chain)).toEqual({ valid: true });
  });

  it('validates a correct multi-event chain', () => {
    const chain = buildChain(5);
    expect(verifyChain(chain)).toEqual({ valid: true });
  });

  it('detects a tampered event hash', () => {
    const chain = buildChain(3);
    chain[1].eventHash = 'tampered';
    expect(verifyChain(chain)).toEqual({ valid: false, brokenAt: 1 });
  });

  it('detects a broken chain link (wrong prevHash)', () => {
    const chain = buildChain(3);
    chain[2] = {
      ...chain[2],
      prevHash: 'wrong-link',
    };
    chain[2].eventHash = computeEventHash(chain[2]);
    expect(verifyChain(chain)).toEqual({ valid: false, brokenAt: 2 });
  });

  it('returns valid for an empty chain', () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });

  it('works with events that lack eventHash (recomputes)', () => {
    const events: HashableEvent[] = [
      makeEvent({ id: 'evt-0', prevHash: null }),
    ];
    expect(verifyChain(events)).toEqual({ valid: true });
  });
});
