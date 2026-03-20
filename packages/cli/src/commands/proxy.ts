import { Command } from 'commander';
import { existsSync, readdirSync } from 'node:fs';
import { SqliteAuditStore } from '@imara/store';
import { PolicyEngine, loadPolicyFile, defaultPolicies } from '@imara/policy';
import { startProxy } from '@imara/proxy';
import { IMARA_DB, IMARA_POLICIES_DIR } from '../paths.js';

export function registerProxyCommand(program: Command): void {
  program
    .command('proxy')
    .description('Run the Imara MCP proxy (typically called by wrapped MCP config)')
    .requiredOption('--downstream-command <cmd>', 'Command to run the real MCP server')
    .requiredOption('--downstream-args <args>', 'Comma-separated args for the downstream command')
    .requiredOption('--server-name <name>', 'Name of the MCP server being proxied')
    .option('--session-id <id>', 'Session ID for grouping events')
    .action(async (opts) => {
      const store = new SqliteAuditStore(IMARA_DB);

      // Load policies
      const policyEngine = new PolicyEngine(defaultPolicies);
      if (existsSync(IMARA_POLICIES_DIR)) {
        try {
          const files = readdirSync(IMARA_POLICIES_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
          for (const file of files) {
            const rules = loadPolicyFile(`${IMARA_POLICIES_DIR}/${file}`);
            policyEngine.setRules([...defaultPolicies, ...rules]);
          }
        } catch {
          // Fall back to defaults
        }
      }

      const downstreamArgs = opts.downstreamArgs.split(',');

      await startProxy({
        downstreamCommand: opts.downstreamCommand,
        downstreamArgs,
        serverName: opts.serverName,
        store,
        policyEngine,
        sessionId: opts.sessionId,
      });
    });
}
