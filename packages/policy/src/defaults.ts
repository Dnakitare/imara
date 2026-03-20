import type { PolicyRule } from '@imara/core';

export const defaultPolicies: PolicyRule[] = [
  {
    name: 'log-all',
    description: 'Log all tool calls for audit trail',
    priority: 100,
    match: { tools: [{ tool: '*' }] },
    action: 'log',
    tags: ['audit'],
  },
  {
    name: 'flag-destructive-ops',
    description: 'Flag destructive file and git operations as high risk',
    priority: 50,
    match: {
      tools: [
        { tool: 'delete_file' },
        { tool: 'remove_directory' },
        { tool: 'git_push' },
        { tool: 'git_reset' },
        { tool: 'drop_*' },
        { tool: 'rm_*' },
      ],
    },
    action: 'log',
    reason: 'Destructive operation flagged for review',
    tags: ['destructive', 'high-risk'],
    complianceFrameworks: ['SOC2-CC6.1'],
  },
  {
    name: 'block-destructive-on-protected-branches',
    description: 'Block destructive git operations on main/master/production',
    priority: 10,
    match: {
      tools: [
        { tool: 'git_push' },
        { tool: 'git_reset' },
        { tool: 'git_force_push' },
      ],
      arguments: [
        {
          field: 'branch',
          operator: 'in',
          value: ['main', 'master', 'production'],
        },
      ],
    },
    action: 'deny',
    reason: 'Destructive operations on protected branches are not allowed',
    tags: ['destructive', 'protected-branch'],
    complianceFrameworks: ['SOC2-CC6.1', 'SOC2-CC8.1'],
  },
  {
    name: 'rate-limit-writes',
    description: 'Rate limit write operations to prevent runaway agents',
    priority: 20,
    match: {
      tools: [
        { tool: 'write_file' },
        { tool: 'create_file' },
        { tool: 'edit_file' },
        { tool: 'insert_*' },
        { tool: 'update_*' },
        { tool: 'delete_*' },
      ],
    },
    action: 'allow',
    rateLimit: {
      maxCalls: 20,
      windowSeconds: 60,
    },
    reason: 'Rate limited write operation',
    tags: ['rate-limit'],
  },
];

export function getDefaultPolicyYaml(): string {
  return `# Imara Default Policy Configuration
version: "1.0"
policies:
  - name: log-all
    description: Log all tool calls for audit trail
    priority: 100
    match:
      tools:
        - tool: "*"
    action: log
    tags:
      - audit

  - name: flag-destructive-ops
    description: Flag destructive file and git operations as high risk
    priority: 50
    match:
      tools:
        - tool: delete_file
        - tool: remove_directory
        - tool: git_push
        - tool: git_reset
        - tool: "drop_*"
        - tool: "rm_*"
    action: log
    reason: Destructive operation flagged for review
    tags:
      - destructive
      - high-risk
    complianceFrameworks:
      - SOC2-CC6.1

  - name: block-destructive-on-protected-branches
    description: Block destructive git operations on main/master/production
    priority: 10
    match:
      tools:
        - tool: git_push
        - tool: git_reset
        - tool: git_force_push
      arguments:
        - field: branch
          operator: in
          value:
            - main
            - master
            - production
    action: deny
    reason: Destructive operations on protected branches are not allowed
    tags:
      - destructive
      - protected-branch
    complianceFrameworks:
      - SOC2-CC6.1
      - SOC2-CC8.1

  - name: rate-limit-writes
    description: Rate limit write operations to prevent runaway agents
    priority: 20
    match:
      tools:
        - tool: write_file
        - tool: create_file
        - tool: edit_file
        - tool: "insert_*"
        - tool: "update_*"
        - tool: "delete_*"
    action: allow
    rateLimit:
      maxCalls: 20
      windowSeconds: 60
    reason: Rate limited write operation
    tags:
      - rate-limit
`;
}
