import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { PolicyConfigSchema } from '@imara/core';
import type { PolicyConfig, PolicyRule } from '@imara/core';

export function loadPolicyFile(filePath: string): PolicyRule[] {
  const content = readFileSync(filePath, 'utf-8');
  return parsePolicyYaml(content);
}

export function parsePolicyYaml(content: string): PolicyRule[] {
  const raw = parseYaml(content);
  const config = PolicyConfigSchema.parse(raw);
  return config.policies as PolicyRule[];
}
