#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerProxyCommand } from './commands/proxy.js';
import { registerTailCommand } from './commands/tail.js';
import { registerWrapCommand } from './commands/wrap.js';
import { registerUnwrapCommand } from './commands/unwrap.js';
import { registerVerifyCommand } from './commands/verify.js';
import { registerStatusCommand } from './commands/status.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { runSetup } from './commands/setup.js';

const program = new Command();

program
  .name('imara')
  .description('Runtime governance layer for AI agents')
  .version('0.1.0');

registerInitCommand(program);
registerProxyCommand(program);
registerTailCommand(program);
registerWrapCommand(program);
registerUnwrapCommand(program);
registerVerifyCommand(program);
registerStatusCommand(program);
registerDashboardCommand(program);

// If no subcommand given, run the default setup flow
program.action(async () => {
  await runSetup();
});

program.parse();
