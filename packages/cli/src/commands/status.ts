import { Command } from 'commander';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { SqliteAuditStore } from '@imara/store';
import { IMARA_DB, IMARA_HOME } from '../paths.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show Imara status and audit statistics')
    .action(async () => {
      if (!existsSync(IMARA_HOME)) {
        console.log(chalk.red('Imara not initialized. Run: imara init'));
        process.exit(1);
      }

      console.log(chalk.bold('Imara Status'));
      console.log(chalk.gray('─'.repeat(40)));

      if (!existsSync(IMARA_DB)) {
        console.log(chalk.yellow('Database not found.'));
        return;
      }

      const store = new SqliteAuditStore(IMARA_DB);
      const totalEvents = store.getEventCount();
      const sessions = store.getSessionIds();

      console.log(`  ${chalk.gray('Home:')}      ${IMARA_HOME}`);
      console.log(`  ${chalk.gray('Database:')}  ${IMARA_DB}`);
      console.log(`  ${chalk.gray('Events:')}    ${totalEvents}`);
      console.log(`  ${chalk.gray('Sessions:')}  ${sessions.length}`);

      if (totalEvents > 0) {
        const recentEvents = store.query({ limit: 5 });
        console.log();
        console.log(chalk.bold('Recent Events:'));
        recentEvents.forEach(event => {
          const time = new Date(event.timestamp).toLocaleString();
          const decision = event.policyDecision === 'allow'
            ? chalk.green('allow')
            : chalk.red(event.policyDecision);
          console.log(`  ${chalk.gray(time)} ${decision} ${event.serverName}/${event.toolName}`);
        });
      }

      store.close();
    });
}
