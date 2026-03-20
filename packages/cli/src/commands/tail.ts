import { Command } from 'commander';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { SqliteAuditStore } from '@imara/store';
import { IMARA_DB } from '../paths.js';

export function registerTailCommand(program: Command): void {
  program
    .command('tail')
    .description('Live stream audit events in the terminal')
    .option('-n, --lines <count>', 'Number of recent events to show', '20')
    .option('-f, --follow', 'Follow mode — poll for new events', false)
    .option('--tool <name>', 'Filter by tool name')
    .option('--server <name>', 'Filter by server name')
    .option('--decision <type>', 'Filter by policy decision (allow/deny/escalate)')
    .action(async (opts) => {
      if (!existsSync(IMARA_DB)) {
        console.error(chalk.red('Imara not initialized. Run: imara init'));
        process.exit(1);
      }

      const store = new SqliteAuditStore(IMARA_DB);
      const limit = parseInt(opts.lines, 10);

      const printEvent = (event: any) => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const decision = formatDecision(event.policyDecision);
        const server = chalk.gray(`[${event.serverName}]`);
        const tool = chalk.white.bold(event.toolName);
        const latency = event.resultLatencyMs != null ? chalk.gray(`${event.resultLatencyMs}ms`) : '';
        const status = formatStatus(event.resultStatus);

        console.log(`${chalk.gray(time)} ${decision} ${server} ${tool} ${status} ${latency}`);

        // Show args summary (truncated)
        const argsStr = JSON.stringify(event.toolArguments);
        if (argsStr.length > 2) {
          const truncated = argsStr.length > 120 ? argsStr.slice(0, 120) + '...' : argsStr;
          console.log(chalk.gray(`  args: ${truncated}`));
        }

        if (event.policyReason && event.policyDecision !== 'allow') {
          console.log(chalk.yellow(`  reason: ${event.policyReason}`));
        }
      };

      // Show recent events
      const events = store.query({
        toolName: opts.tool,
        serverName: opts.server,
        policyDecision: opts.decision,
        limit,
      });

      if (events.length === 0) {
        console.log(chalk.gray('No events yet. Use your AI agent and events will appear here.'));
      } else {
        // Events come in DESC order from query, reverse for display
        events.reverse().forEach(printEvent);
      }

      if (opts.follow) {
        console.log(chalk.gray('\n--- Following new events (Ctrl+C to stop) ---\n'));
        let lastCount = store.getEventCount();

        const poll = setInterval(() => {
          const currentCount = store.getEventCount();
          if (currentCount > lastCount) {
            const newEvents = store.query({
              toolName: opts.tool,
              serverName: opts.server,
              policyDecision: opts.decision,
              limit: currentCount - lastCount,
            });
            newEvents.reverse().forEach(printEvent);
            lastCount = currentCount;
          }
        }, 500);

        process.on('SIGINT', () => {
          clearInterval(poll);
          store.close();
          process.exit(0);
        });
      } else {
        store.close();
      }
    });
}

function formatDecision(decision: string): string {
  switch (decision) {
    case 'allow': return chalk.green('ALLOW');
    case 'deny': return chalk.red('DENY ');
    case 'escalate': return chalk.yellow('ESCAL');
    default: return chalk.gray(decision.padEnd(5));
  }
}

function formatStatus(status?: string): string {
  if (!status) return '';
  switch (status) {
    case 'success': return chalk.green('✓');
    case 'error': return chalk.red('✗');
    case 'blocked': return chalk.red('⊘');
    default: return '';
  }
}
