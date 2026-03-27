import picomatch from 'picomatch';
import type { ToolMatcher, ArgumentMatcher } from '@imara/core';

// Cache compiled regex patterns to avoid re-compilation
const regexCache = new Map<string, RegExp | null>();
const MAX_REGEX_CACHE = 1000;
const MAX_REGEX_PATTERN_LENGTH = 500;

/**
 * Safely compile a regex pattern. Returns null if the pattern is invalid
 * or too complex (potential ReDoS).
 */
function safeRegex(pattern: string): RegExp | null {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return null;

  const cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;

  try {
    const re = new RegExp(pattern);
    // Evict oldest entries if cache is full
    if (regexCache.size >= MAX_REGEX_CACHE) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey !== undefined) regexCache.delete(firstKey);
    }
    regexCache.set(pattern, re);
    return re;
  } catch {
    regexCache.set(pattern, null);
    return null;
  }
}

export function matchesTool(
  matcher: ToolMatcher,
  toolName: string,
  serverName?: string
): boolean {
  const toolMatch = picomatch.isMatch(toolName, matcher.tool);
  if (!toolMatch) return false;
  if (matcher.server && serverName) {
    return picomatch.isMatch(serverName, matcher.server);
  }
  return true;
}

export function matchesArguments(
  matchers: ArgumentMatcher[],
  args: Record<string, unknown>
): boolean {
  return matchers.every(matcher => matchArgument(matcher, args));
}

function matchArgument(
  matcher: ArgumentMatcher,
  args: Record<string, unknown>
): boolean {
  const value = getNestedValue(args, matcher.field);

  switch (matcher.operator) {
    case 'eq':
      return value === matcher.value;
    case 'neq':
      return value !== matcher.value;
    case 'in':
      return Array.isArray(matcher.value) && matcher.value.includes(value);
    case 'not_in':
      return Array.isArray(matcher.value) && !matcher.value.includes(value);
    case 'matches': {
      if (typeof value !== 'string' || typeof matcher.value !== 'string') return false;
      const re = safeRegex(matcher.value);
      if (!re) return false;
      return re.test(value);
    }
    case 'contains':
      return typeof value === 'string' && typeof matcher.value === 'string'
        && value.includes(matcher.value);
    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  return keys.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      const record = acc as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        return record[key];
      }
    }
    return undefined;
  }, obj);
}
