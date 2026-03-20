import picomatch from 'picomatch';
import type { ToolMatcher, ArgumentMatcher } from '@imara/core';

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
    case 'matches':
      return typeof value === 'string' && typeof matcher.value === 'string'
        && new RegExp(matcher.value).test(value);
    case 'contains':
      return typeof value === 'string' && typeof matcher.value === 'string'
        && value.includes(matcher.value);
    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
