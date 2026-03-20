import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';
import { IMARA_BACKUPS_DIR } from '../paths.js';

const MCP_CONFIG_LOCATIONS = [
  join(process.cwd(), '.mcp.json'),
  join(homedir(), '.claude.json'),
];

if (process.platform === 'darwin') {
  MCP_CONFIG_LOCATIONS.push(
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  );
}

export function registerUnwrapCommand(program: Command): void {
  program
    .command('unwrap')
    .description('Restore original MCP config from backup')
    .option('--config <path>', 'Path to MCP config file')
    .action(async (opts) => {
      // Find the latest backup
      if (!existsSync(IMARA_BACKUPS_DIR)) {
        console.error(chalk.red('No backups found. Nothing to unwrap.'));
        process.exit(1);
      }

      const backups = readdirSync(IMARA_BACKUPS_DIR)
        .filter(f => f.startsWith('mcp-config-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (backups.length === 0) {
        console.error(chalk.red('No backups found. Nothing to unwrap.'));
        process.exit(1);
      }

      const latestBackup = join(IMARA_BACKUPS_DIR, backups[0]);
      console.log(chalk.gray(`Restoring from: ${latestBackup}`));

      // Find target config
      let configPath = opts.config;
      if (!configPath) {
        configPath = MCP_CONFIG_LOCATIONS.find(p => existsSync(p));
      }

      if (!configPath) {
        console.error(chalk.red('No MCP config found to restore to.'));
        process.exit(1);
      }

      const backupContent = readFileSync(latestBackup, 'utf-8');
      writeFileSync(configPath, backupContent);

      console.log(chalk.green(`✓ Restored ${configPath} from backup`));
      console.log(chalk.gray(`  Backup used: ${latestBackup}`));
    });
}
