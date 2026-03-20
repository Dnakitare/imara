import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';
import { IMARA_BACKUPS_DIR, IMARA_HOME } from '../paths.js';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

const MCP_CONFIG_LOCATIONS = [
  join(process.cwd(), '.mcp.json'),
  join(homedir(), '.claude.json'),
];

// Add Claude Desktop config location on macOS
if (process.platform === 'darwin') {
  MCP_CONFIG_LOCATIONS.push(
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  );
}

export function registerWrapCommand(program: Command): void {
  program
    .command('wrap')
    .description('Auto-patch MCP config to route through Imara proxy')
    .option('--config <path>', 'Path to MCP config file (auto-detected if not specified)')
    .option('--dry-run', 'Show what would be changed without modifying files')
    .action(async (opts) => {
      if (!existsSync(IMARA_HOME)) {
        console.error(chalk.red('Imara not initialized. Run: imara init'));
        process.exit(1);
      }

      // Find MCP config
      let configPath = opts.config;
      if (!configPath) {
        configPath = MCP_CONFIG_LOCATIONS.find(p => existsSync(p));
      }

      if (!configPath || !existsSync(configPath)) {
        console.error(chalk.red('No MCP config found. Searched:'));
        MCP_CONFIG_LOCATIONS.forEach(p => console.error(chalk.gray(`  ${p}`)));
        console.error(chalk.gray('\nUse --config <path> to specify manually.'));
        process.exit(1);
      }

      console.log(chalk.gray(`Found MCP config: ${configPath}`));

      const raw = readFileSync(configPath, 'utf-8');
      const config: McpConfig = JSON.parse(raw);

      if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        console.log(chalk.yellow('No MCP servers found in config.'));
        return;
      }

      // Create backup
      mkdirSync(IMARA_BACKUPS_DIR, { recursive: true });
      const backupName = `mcp-config-${Date.now()}.json`;
      const backupPath = join(IMARA_BACKUPS_DIR, backupName);

      if (!opts.dryRun) {
        copyFileSync(configPath, backupPath);
        console.log(chalk.gray(`Backup saved: ${backupPath}`));
      }

      // Wrap each server
      const wrapped: Record<string, McpServerConfig> = {};
      let wrappedCount = 0;

      for (const [name, server] of Object.entries(config.mcpServers)) {
        // Skip if already wrapped
        if (isAlreadyWrapped(server)) {
          console.log(chalk.gray(`  ${name}: already wrapped, skipping`));
          wrapped[name] = server;
          continue;
        }

        const downstreamArgs = server.args?.join(',') ?? '';

        const wrappedServer: McpServerConfig = {
          command: 'npx',
          args: [
            'imara',
            'proxy',
            '--downstream-command', server.command,
            '--downstream-args', downstreamArgs,
            '--server-name', name,
          ],
        };

        // Preserve env vars
        if (server.env) {
          wrappedServer.env = server.env;
        }

        wrapped[name] = wrappedServer;
        wrappedCount++;

        if (opts.dryRun) {
          console.log(chalk.cyan(`  ${name}: would wrap`));
          console.log(chalk.gray(`    ${server.command} ${(server.args ?? []).join(' ')}`));
          console.log(chalk.gray(`    → imara proxy --downstream-command ${server.command} --downstream-args ${downstreamArgs} --server-name ${name}`));
        } else {
          console.log(chalk.green(`  ✓ ${name}: wrapped`));
        }
      }

      if (!opts.dryRun && wrappedCount > 0) {
        config.mcpServers = wrapped;
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        console.log();
        console.log(chalk.green(`✓ Wrapped ${wrappedCount} server(s) in ${configPath}`));
        console.log(chalk.gray(`  Backup: ${backupPath}`));
        console.log(chalk.gray(`  To undo: imara unwrap`));
      } else if (wrappedCount === 0) {
        console.log(chalk.yellow('All servers already wrapped.'));
      }
    });
}

function isAlreadyWrapped(server: McpServerConfig): boolean {
  if (server.args?.includes('imara') && server.args?.includes('proxy')) {
    return true;
  }
  if (server.command === 'imara' || server.command.endsWith('/imara')) {
    return true;
  }
  return false;
}
