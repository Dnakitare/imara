import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../engine.js';
import type { PolicyRule } from '@imara/core';

function makeRule(overrides: Partial<PolicyRule> & { name: string }): PolicyRule {
  return {
    priority: 50,
    match: { tools: [{ tool: '*' }] },
    action: 'allow',
    ...overrides,
  };
}

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe('basic evaluation', () => {
    it('defaults to allow when no rules match', () => {
      engine.setRules([]);
      const result = engine.evaluate({
        toolName: 'read_file',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('allow');
      expect(result.policiesEvaluated).toEqual([]);
    });

    it('matches and returns allow for matching rule', () => {
      engine.setRules([
        makeRule({ name: 'allow-reads', match: { tools: [{ tool: 'read_*' }] }, action: 'allow' }),
      ]);
      const result = engine.evaluate({
        toolName: 'read_file',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('allow');
      expect(result.policiesEvaluated).toContain('allow-reads');
    });

    it('returns deny for deny rules', () => {
      engine.setRules([
        makeRule({ name: 'block-writes', match: { tools: [{ tool: 'write_*' }] }, action: 'deny', reason: 'No writes' }),
      ]);
      const result = engine.evaluate({
        toolName: 'write_file',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('No writes');
    });

    it('returns escalate for escalate rules', () => {
      engine.setRules([
        makeRule({ name: 'escalate-deletes', match: { tools: [{ tool: 'delete_*' }] }, action: 'escalate' }),
      ]);
      const result = engine.evaluate({
        toolName: 'delete_file',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('escalate');
    });
  });

  describe('priority ordering', () => {
    it('evaluates higher priority (lower number) rules first', () => {
      engine.setRules([
        makeRule({ name: 'low-priority-allow', priority: 100, match: { tools: [{ tool: '*' }] }, action: 'allow' }),
        makeRule({ name: 'high-priority-deny', priority: 1, match: { tools: [{ tool: '*' }] }, action: 'deny' }),
      ]);
      const result = engine.evaluate({
        toolName: 'anything',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('deny');
      expect(result.policiesEvaluated).toContain('high-priority-deny');
    });

    it('deny short-circuits evaluation', () => {
      engine.setRules([
        makeRule({ name: 'deny-first', priority: 1, match: { tools: [{ tool: '*' }] }, action: 'deny' }),
        makeRule({ name: 'allow-second', priority: 2, match: { tools: [{ tool: '*' }] }, action: 'allow' }),
      ]);
      const result = engine.evaluate({
        toolName: 'test',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('deny');
      expect(result.policiesEvaluated).not.toContain('allow-second');
    });
  });

  describe('argument matching', () => {
    it('applies argument matchers when specified', () => {
      engine.setRules([
        makeRule({
          name: 'block-main-push',
          priority: 10,
          match: {
            tools: [{ tool: 'git_push' }],
            arguments: [{ field: 'branch', operator: 'in', value: ['main', 'master'] }],
          },
          action: 'deny',
          reason: 'Protected branch',
        }),
      ]);

      const blocked = engine.evaluate({
        toolName: 'git_push',
        serverName: 'git',
        arguments: { branch: 'main' },
      });
      expect(blocked.decision).toBe('deny');

      const allowed = engine.evaluate({
        toolName: 'git_push',
        serverName: 'git',
        arguments: { branch: 'feature/test' },
      });
      expect(allowed.decision).toBe('allow');
    });
  });

  describe('log action', () => {
    it('log action records match but does not change decision', () => {
      engine.setRules([
        makeRule({ name: 'log-all', priority: 100, match: { tools: [{ tool: '*' }] }, action: 'log' }),
      ]);
      const result = engine.evaluate({
        toolName: 'read_file',
        serverName: 'test',
        arguments: {},
      });
      expect(result.decision).toBe('allow');
      expect(result.policiesEvaluated).toContain('log-all');
    });
  });

  describe('rate limiting', () => {
    it('allows calls within rate limit', () => {
      engine.setRules([
        makeRule({
          name: 'rate-limit-writes',
          priority: 20,
          match: { tools: [{ tool: 'write_file' }] },
          action: 'allow',
          rateLimit: { maxCalls: 3, windowSeconds: 60 },
        }),
      ]);

      for (let i = 0; i < 3; i++) {
        const result = engine.evaluate({
          toolName: 'write_file',
          serverName: 'test',
          arguments: {},
        });
        expect(result.decision).toBe('allow');
      }
    });

    it('denies calls exceeding rate limit', () => {
      engine.setRules([
        makeRule({
          name: 'rate-limit-writes',
          priority: 20,
          match: { tools: [{ tool: 'write_file' }] },
          action: 'allow',
          rateLimit: { maxCalls: 2, windowSeconds: 60 },
        }),
      ]);

      // First two should be allowed
      engine.evaluate({ toolName: 'write_file', serverName: 'test', arguments: {} });
      engine.evaluate({ toolName: 'write_file', serverName: 'test', arguments: {} });

      // Third should be denied
      const result = engine.evaluate({ toolName: 'write_file', serverName: 'test', arguments: {} });
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('Rate limit exceeded');
    });
  });

  describe('default deny reason', () => {
    it('generates reason from policy name when no reason provided', () => {
      engine.setRules([
        makeRule({ name: 'my-block-rule', match: { tools: [{ tool: '*' }] }, action: 'deny' }),
      ]);
      const result = engine.evaluate({ toolName: 'test', serverName: 'test', arguments: {} });
      expect(result.reason).toBe('Blocked by policy: my-block-rule');
    });
  });
});
