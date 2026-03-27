import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolCallInterceptor } from '../interceptor.js';
import { PolicyEngine } from '@imara/policy';
import { SqliteAuditStore } from '@imara/store';
import { verifyChain } from '@imara/core';
import type { PolicyRule } from '@imara/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ToolCallInterceptor', () => {
  let store: SqliteAuditStore;
  let engine: PolicyEngine;
  let interceptor: ToolCallInterceptor;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'imara-interceptor-test-'));
    store = new SqliteAuditStore(join(tmpDir, 'test.db'));
    engine = new PolicyEngine();
    interceptor = new ToolCallInterceptor({
      store,
      policyEngine: engine,
      serverName: 'test-server',
      sessionId: 'test-session',
    });
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('evaluatePolicy', () => {
    it('returns allow when no rules configured', () => {
      const result = interceptor.evaluatePolicy('read_file', {});
      expect(result.decision).toBe('allow');
    });

    it('delegates to policy engine', () => {
      const rules: PolicyRule[] = [{
        name: 'block-writes',
        priority: 10,
        match: { tools: [{ tool: 'write_*' }] },
        action: 'deny',
        reason: 'Writes blocked',
      }];
      engine.setRules(rules);

      const result = interceptor.evaluatePolicy('write_file', {});
      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('Writes blocked');
    });
  });

  describe('createAndStoreEvent', () => {
    it('creates an event with a valid hash', () => {
      const event = interceptor.createAndStoreEvent({
        toolName: 'read_file',
        toolArguments: { path: '/tmp/test.txt' },
        policyDecision: 'allow',
        policiesEvaluated: ['log-all'],
        resultStatus: 'success',
        resultSummary: 'File read OK',
        resultLatencyMs: 15,
      });

      expect(event.id).toBeTruthy();
      expect(event.sessionId).toBe('test-session');
      expect(event.serverName).toBe('test-server');
      expect(event.eventHash).toMatch(/^[a-f0-9]{64}$/);
      expect(event.prevHash).toBeNull();
    });

    it('chains hashes across events', () => {
      const e1 = interceptor.createAndStoreEvent({
        toolName: 'read_file',
        toolArguments: {},
        policyDecision: 'allow',
        policiesEvaluated: [],
      });

      const e2 = interceptor.createAndStoreEvent({
        toolName: 'write_file',
        toolArguments: {},
        policyDecision: 'allow',
        policiesEvaluated: [],
      });

      expect(e2.prevHash).toBe(e1.eventHash);
    });

    it('builds a verifiable chain', () => {
      const created: ReturnType<typeof interceptor.createAndStoreEvent>[] = [];
      for (let i = 0; i < 5; i++) {
        created.push(interceptor.createAndStoreEvent({
          toolName: `tool_${i}`,
          toolArguments: { index: i },
          policyDecision: 'allow',
          policiesEvaluated: [],
        }));
      }

      // Verify using the events as returned by the interceptor (guaranteed order)
      const chainResult = verifyChain(created);
      expect(chainResult.valid).toBe(true);
    });

    it('persists events to the store', () => {
      interceptor.createAndStoreEvent({
        toolName: 'read_file',
        toolArguments: { path: '/test' },
        policyDecision: 'deny',
        policyReason: 'Blocked',
        policiesEvaluated: ['block-rule'],
        resultStatus: 'blocked',
      });

      expect(store.getEventCount()).toBe(1);
      const events = store.getAllEvents();
      expect(events[0].policyDecision).toBe('deny');
      expect(events[0].policyReason).toBe('Blocked');
      expect(events[0].resultStatus).toBe('blocked');
    });
  });
});
