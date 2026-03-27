import { describe, it, expect } from 'vitest';
import { matchesTool, matchesArguments } from '../matchers.js';

describe('matchesTool', () => {
  it('matches exact tool name', () => {
    expect(matchesTool({ tool: 'read_file' }, 'read_file')).toBe(true);
  });

  it('rejects non-matching tool name', () => {
    expect(matchesTool({ tool: 'read_file' }, 'write_file')).toBe(false);
  });

  it('matches glob patterns', () => {
    expect(matchesTool({ tool: 'read_*' }, 'read_file')).toBe(true);
    expect(matchesTool({ tool: 'read_*' }, 'write_file')).toBe(false);
  });

  it('matches wildcard for all tools', () => {
    expect(matchesTool({ tool: '*' }, 'anything')).toBe(true);
  });

  it('matches with server filter', () => {
    expect(matchesTool({ tool: '*', server: 'fs-*' }, 'read_file', 'fs-server')).toBe(true);
    expect(matchesTool({ tool: '*', server: 'fs-*' }, 'read_file', 'git-server')).toBe(false);
  });

  it('ignores server filter when serverName is not provided', () => {
    expect(matchesTool({ tool: 'read_file', server: 'fs-server' }, 'read_file')).toBe(true);
  });

  it('ignores server filter when matcher has no server', () => {
    expect(matchesTool({ tool: 'read_file' }, 'read_file', 'any-server')).toBe(true);
  });
});

describe('matchesArguments', () => {
  it('matches eq operator', () => {
    expect(matchesArguments(
      [{ field: 'branch', operator: 'eq', value: 'main' }],
      { branch: 'main' }
    )).toBe(true);

    expect(matchesArguments(
      [{ field: 'branch', operator: 'eq', value: 'main' }],
      { branch: 'dev' }
    )).toBe(false);
  });

  it('matches neq operator', () => {
    expect(matchesArguments(
      [{ field: 'branch', operator: 'neq', value: 'main' }],
      { branch: 'dev' }
    )).toBe(true);
  });

  it('matches in operator', () => {
    expect(matchesArguments(
      [{ field: 'branch', operator: 'in', value: ['main', 'master'] }],
      { branch: 'main' }
    )).toBe(true);

    expect(matchesArguments(
      [{ field: 'branch', operator: 'in', value: ['main', 'master'] }],
      { branch: 'dev' }
    )).toBe(false);
  });

  it('matches not_in operator', () => {
    expect(matchesArguments(
      [{ field: 'branch', operator: 'not_in', value: ['main', 'master'] }],
      { branch: 'dev' }
    )).toBe(true);
  });

  it('matches regex with matches operator', () => {
    expect(matchesArguments(
      [{ field: 'path', operator: 'matches', value: '\\.secret$' }],
      { path: 'config.secret' }
    )).toBe(true);

    expect(matchesArguments(
      [{ field: 'path', operator: 'matches', value: '\\.secret$' }],
      { path: 'config.json' }
    )).toBe(false);
  });

  it('matches contains operator', () => {
    expect(matchesArguments(
      [{ field: 'body', operator: 'contains', value: 'password' }],
      { body: 'reset password link' }
    )).toBe(true);
  });

  it('requires all matchers to pass', () => {
    expect(matchesArguments(
      [
        { field: 'branch', operator: 'eq', value: 'main' },
        { field: 'force', operator: 'eq', value: true },
      ],
      { branch: 'main', force: true }
    )).toBe(true);

    expect(matchesArguments(
      [
        { field: 'branch', operator: 'eq', value: 'main' },
        { field: 'force', operator: 'eq', value: true },
      ],
      { branch: 'main', force: false }
    )).toBe(false);
  });

  it('handles nested field paths', () => {
    expect(matchesArguments(
      [{ field: 'config.env', operator: 'eq', value: 'production' }],
      { config: { env: 'production' } }
    )).toBe(true);
  });

  it('returns false for missing fields', () => {
    expect(matchesArguments(
      [{ field: 'missing', operator: 'eq', value: 'test' }],
      { other: 'field' }
    )).toBe(false);
  });

  describe('matches operator safety (safeRegex)', () => {
    it('returns false for invalid regex pattern', () => {
      expect(matchesArguments(
        [{ field: 'path', operator: 'matches', value: '[invalid(' }],
        { path: 'anything' }
      )).toBe(false);
    });

    it('returns false for overly long pattern (>500 chars)', () => {
      expect(matchesArguments(
        [{ field: 'path', operator: 'matches', value: 'a'.repeat(501) }],
        { path: 'a'.repeat(600) }
      )).toBe(false);
    });

    it('caches and reuses compiled regex', () => {
      // Same pattern used twice should return consistent results
      const matcher = [{ field: 'val', operator: 'matches' as const, value: '^test\\d+$' }];
      expect(matchesArguments(matcher, { val: 'test123' })).toBe(true);
      expect(matchesArguments(matcher, { val: 'test456' })).toBe(true);
      expect(matchesArguments(matcher, { val: 'nope' })).toBe(false);
    });
  });
});
