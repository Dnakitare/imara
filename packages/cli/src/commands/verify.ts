import { Command } from 'commander';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { verifyChain } from '@imara/core';
import { SqliteAuditStore } from '@imara/store';
import { IMARA_DB } from '../paths.js';

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Verify the integrity of the audit hash chain')
    .option('--session <id>', 'Verify a specific session only')
    .action(async (opts) => {
      if (!existsSync(IMARA_DB)) {
        console.error(chalk.red('Imara not initialized. Run: imara init'));
        process.exit(1);
      }

      const store = new SqliteAuditStore(IMARA_DB);
      const events = store.getAllEvents(10000);

      if (events.length === 0) {
        console.log(chalk.yellow('No events to verify.'));
        store.close();
        return;
      }

      console.log(chalk.gray(`Verifying ${events.length} events...`));

      const result = verifyChain(events);

      if (result.valid) {
        console.log(chalk.green(`✓ Hash chain integrity verified (${events.length} events)`));
      } else {
        console.log(chalk.red(`✗ Hash chain broken at event index ${result.brokenAt}`));
        if (result.brokenAt !== undefined) {
          const broken = events[result.brokenAt];
          console.log(chalk.red(`  Event ID: ${broken.id}`));
          console.log(chalk.red(`  Timestamp: ${broken.timestamp}`));
          console.log(chalk.red(`  Tool: ${broken.toolName}`));
        }
      }

      store.close();
    });
}
