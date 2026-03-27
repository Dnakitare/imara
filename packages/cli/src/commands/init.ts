import { Command } from 'commander';
import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import chalk from 'chalk';
import { getDefaultPolicyYaml } from '@imara/policy';
import {
  IMARA_HOME,
  IMARA_CONFIG,
  IMARA_DB,
  IMARA_POLICIES_DIR,
  IMARA_DEFAULT_POLICY,
  IMARA_BACKUPS_DIR,
} from '../paths.js';
import { SqliteAuditStore } from '@imara/store';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Imara configuration and audit database')
    .option('--force', 'Overwrite existing configuration')
    .action(async (opts) => {
      const exists = existsSync(IMARA_HOME);
      if (exists && !opts.force) {
        console.log(chalk.yellow('Imara is already initialized at ~/.imara/'));
        console.log(chalk.gray('Use --force to reinitialize'));
        return;
      }

      // Create directories with restricted permissions
      mkdirSync(IMARA_HOME, { recursive: true, mode: 0o700 });
      mkdirSync(IMARA_POLICIES_DIR, { recursive: true, mode: 0o700 });
      mkdirSync(IMARA_BACKUPS_DIR, { recursive: true, mode: 0o700 });

      // Write default config
      const config = {
        version: '0.1.0',
        store: { type: 'sqlite', path: IMARA_DB },
        policies: { directory: IMARA_POLICIES_DIR },
      };
      writeFileSync(IMARA_CONFIG, JSON.stringify(config, null, 2), { mode: 0o600 });

      // Write default policy
      writeFileSync(IMARA_DEFAULT_POLICY, getDefaultPolicyYaml(), { mode: 0o600 });

      // Initialize SQLite database
      const store = new SqliteAuditStore(IMARA_DB);
      store.close();
      // Restrict DB file permissions — audit data is sensitive
      chmodSync(IMARA_DB, 0o600);

      console.log(chalk.green('✓ Imara initialized successfully!'));
      console.log();
      console.log(`  ${chalk.gray('Config:')}    ${IMARA_CONFIG}`);
      console.log(`  ${chalk.gray('Database:')}  ${IMARA_DB}`);
      console.log(`  ${chalk.gray('Policies:')} ${IMARA_DEFAULT_POLICY}`);
      console.log(`  ${chalk.gray('Backups:')}  ${IMARA_BACKUPS_DIR}`);
      console.log();
      console.log(`Next steps:`);
      console.log(`  ${chalk.cyan('imara wrap')}       Auto-configure MCP servers to use Imara`);
      console.log(`  ${chalk.cyan('imara tail')}       Watch audit events in real-time`);
      console.log(`  ${chalk.cyan('imara dashboard')}  Open the web dashboard`);
    });
}
