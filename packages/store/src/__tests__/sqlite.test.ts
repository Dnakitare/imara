import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteAuditStore } from '../sqlite.js';
import { computeEventHash, verifyChain } from '@imara/core';
import type { AuditEvent } from '@imara/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeEvent(overrides: Partial<AuditEvent> = {}, prevHash: string | null = null): AuditEvent {
  const base = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId: 'sess-1',
    serverName: 'test-server',
    toolName: 'read_file',
    toolArguments: { path: '/tmp/test.txt' },
    policyDecision: 'allow' as const,
    policiesEvaluated: ['log-all'],
    prevHash,
    eventHash: '',
  };

  const merged = { ...base, ...overrides, prevHash: overrides.prevHash ?? prevHash };

  merged.eventHash = computeEventHash({
    id: merged.id,
    timestamp: merged.timestamp,
    sessionId: merged.sessionId,
    serverName: merged.serverName,
    toolName: merged.toolName,
    toolArguments: merged.toolArguments,
    policyDecision: merged.policyDecision,
    prevHash: merged.prevHash,
  });

  return merged;
}

describe('SqliteAuditStore', () => {
  let store: SqliteAuditStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'imara-test-'));
    store = new SqliteAuditStore(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('append and retrieve', () => {
    it('stores and retrieves an event', () => {
      const event = makeEvent();
      store.append(event);

      const events = store.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(event.id);
      expect(events[0].toolName).toBe('read_file');
      expect(events[0].toolArguments).toEqual({ path: '/tmp/test.txt' });
    });

    it('preserves all fields through round-trip', () => {
      const event = makeEvent({
        agentId: 'agent-1',
        toolAnnotations: { readOnly: true, destructive: false },
        policyReason: 'Allowed by default',
        resultStatus: 'success',
        resultSummary: 'File read successfully',
        resultLatencyMs: 42,
      });
      store.append(event);

      const retrieved = store.getAllEvents()[0];
      expect(retrieved.agentId).toBe('agent-1');
      expect(retrieved.toolAnnotations).toEqual({ readOnly: true, destructive: false });
      expect(retrieved.policyReason).toBe('Allowed by default');
      expect(retrieved.resultStatus).toBe('success');
      expect(retrieved.resultSummary).toBe('File read successfully');
      expect(retrieved.resultLatencyMs).toBe(42);
      expect(retrieved.eventHash).toBe(event.eventHash);
      expect(retrieved.prevHash).toBe(event.prevHash);
    });
  });

  describe('getLatestHash', () => {
    it('returns null for empty store', () => {
      expect(store.getLatestHash()).toBeNull();
    });

    it('returns the hash of the most recent event', () => {
      const e1 = makeEvent({ timestamp: '2026-03-27T00:00:01.000Z' });
      store.append(e1);

      const e2 = makeEvent({ timestamp: '2026-03-27T00:00:02.000Z' }, e1.eventHash);
      store.append(e2);

      expect(store.getLatestHash()).toBe(e2.eventHash);
    });
  });

  describe('getEventCount', () => {
    it('returns 0 for empty store', () => {
      expect(store.getEventCount()).toBe(0);
    });

    it('returns correct count', () => {
      store.append(makeEvent());
      store.append(makeEvent());
      store.append(makeEvent());
      expect(store.getEventCount()).toBe(3);
    });
  });

  describe('query filters', () => {
    beforeEach(() => {
      store.append(makeEvent({
        id: '00000000-0000-0000-0000-000000000001',
        sessionId: 'sess-1',
        serverName: 'git-server',
        toolName: 'git_push',
        policyDecision: 'deny',
        timestamp: '2026-03-27T00:00:01.000Z',
      }));
      store.append(makeEvent({
        id: '00000000-0000-0000-0000-000000000002',
        sessionId: 'sess-1',
        serverName: 'fs-server',
        toolName: 'read_file',
        policyDecision: 'allow',
        timestamp: '2026-03-27T00:00:02.000Z',
      }));
      store.append(makeEvent({
        id: '00000000-0000-0000-0000-000000000003',
        sessionId: 'sess-2',
        serverName: 'fs-server',
        toolName: 'write_file',
        policyDecision: 'allow',
        timestamp: '2026-03-27T00:00:03.000Z',
      }));
    });

    it('filters by sessionId', () => {
      const results = store.query({ sessionId: 'sess-2' });
      expect(results).toHaveLength(1);
      expect(results[0].toolName).toBe('write_file');
    });

    it('filters by serverName', () => {
      const results = store.query({ serverName: 'git-server' });
      expect(results).toHaveLength(1);
      expect(results[0].toolName).toBe('git_push');
    });

    it('filters by toolName', () => {
      const results = store.query({ toolName: 'read_file' });
      expect(results).toHaveLength(1);
    });

    it('filters by policyDecision', () => {
      const results = store.query({ policyDecision: 'deny' });
      expect(results).toHaveLength(1);
      expect(results[0].toolName).toBe('git_push');
    });

    it('filters by timestamp range', () => {
      const results = store.query({
        fromTimestamp: '2026-03-27T00:00:02.000Z',
        toTimestamp: '2026-03-27T00:00:03.000Z',
      });
      expect(results).toHaveLength(2);
    });

    it('applies limit and offset', () => {
      const results = store.query({ limit: 1, offset: 0 });
      expect(results).toHaveLength(1);
    });

    it('combines multiple filters', () => {
      const results = store.query({
        sessionId: 'sess-1',
        policyDecision: 'allow',
      });
      expect(results).toHaveLength(1);
      expect(results[0].toolName).toBe('read_file');
    });
  });

  describe('getSessionIds', () => {
    it('returns empty array for empty store', () => {
      expect(store.getSessionIds()).toEqual([]);
    });

    it('returns unique session IDs', () => {
      store.append(makeEvent({ sessionId: 'sess-a', timestamp: '2026-03-27T00:00:01.000Z' }));
      store.append(makeEvent({ sessionId: 'sess-b', timestamp: '2026-03-27T00:00:02.000Z' }));
      store.append(makeEvent({ sessionId: 'sess-a', timestamp: '2026-03-27T00:00:03.000Z' }));

      const sessions = store.getSessionIds();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain('sess-a');
      expect(sessions).toContain('sess-b');
    });
  });

  describe('getAllEvents pagination', () => {
    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        store.append(makeEvent({ timestamp: `2026-03-27T00:00:0${i}.000Z` }));
      }

      const page = store.getAllEvents(2, 1);
      expect(page).toHaveLength(2);
    });
  });

  describe('appendAtomic', () => {
    it('returns event with computed prevHash and eventHash', () => {
      const event = store.appendAtomic({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        sessionId: 'sess-1',
        serverName: 'test-server',
        toolName: 'read_file',
        toolArguments: { path: '/test' },
        policyDecision: 'allow',
        policiesEvaluated: ['log-all'],
      });

      expect(event.prevHash).toBeNull();
      expect(event.eventHash).toMatch(/^[a-f0-9]{64}$/);
      expect(event.toolName).toBe('read_file');
    });

    it('chains hashes across multiple calls', () => {
      const e1 = store.appendAtomic({
        id: crypto.randomUUID(),
        timestamp: '2026-03-27T00:00:01.000Z',
        sessionId: 'sess-1',
        serverName: 'test-server',
        toolName: 'tool_1',
        toolArguments: {},
        policyDecision: 'allow',
        policiesEvaluated: [],
      });

      const e2 = store.appendAtomic({
        id: crypto.randomUUID(),
        timestamp: '2026-03-27T00:00:02.000Z',
        sessionId: 'sess-1',
        serverName: 'test-server',
        toolName: 'tool_2',
        toolArguments: {},
        policyDecision: 'allow',
        policiesEvaluated: [],
      });

      const e3 = store.appendAtomic({
        id: crypto.randomUUID(),
        timestamp: '2026-03-27T00:00:03.000Z',
        sessionId: 'sess-1',
        serverName: 'test-server',
        toolName: 'tool_3',
        toolArguments: {},
        policyDecision: 'deny',
        policiesEvaluated: ['block-writes'],
        resultStatus: 'blocked',
      });

      expect(e1.prevHash).toBeNull();
      expect(e2.prevHash).toBe(e1.eventHash);
      expect(e3.prevHash).toBe(e2.eventHash);

      // Verify chain integrity via verifyChain
      const allEvents = store.getAllEvents();
      expect(allEvents).toHaveLength(3);

      const { valid } = verifyChain(allEvents);
      expect(valid).toBe(true);
    });

    it('persists events retrievable by query', () => {
      store.appendAtomic({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        sessionId: 'sess-1',
        serverName: 'git-server',
        toolName: 'git_push',
        toolArguments: { branch: 'main' },
        policyDecision: 'deny',
        policyReason: 'Protected branch',
        policiesEvaluated: ['block-main-push'],
        resultStatus: 'blocked',
      });

      expect(store.getEventCount()).toBe(1);
      const results = store.query({ policyDecision: 'deny' });
      expect(results).toHaveLength(1);
      expect(results[0].policyReason).toBe('Protected branch');
    });
  });
});
