import { Command } from 'commander';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { IMARA_HOME } from '../paths.js';

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Open the Imara web dashboard')
    .option('-p, --port <port>', 'Port to run dashboard on', '3838')
    .action(async (opts) => {
      if (!existsSync(IMARA_HOME)) {
        console.error(chalk.red('Imara not initialized. Run: imara init'));
        process.exit(1);
      }

      // For MVP, the dashboard package handles its own server
      // This command will spawn it
      const port = opts.port;

      try {
        const { spawn } = await import('node:child_process');
        const { join } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const { dirname } = await import('node:path');

        const __dirname = dirname(fileURLToPath(import.meta.url));
        const dashboardDir = join(__dirname, '..', '..', '..', 'dashboard');

        if (!existsSync(dashboardDir)) {
          console.log(chalk.yellow('Dashboard package not found.'));
          console.log(chalk.gray('The dashboard will be available in a future release.'));
          console.log(chalk.gray(`Expected at: ${dashboardDir}`));
          return;
        }

        console.log(chalk.cyan(`Starting Imara Dashboard on port ${port}...`));
        console.log(chalk.gray(`Open http://localhost:${port} in your browser`));

        const child = spawn('npx', ['next', 'dev', '-p', port], {
          cwd: dashboardDir,
          stdio: 'inherit',
          env: { ...process.env, IMARA_DB_PATH: join(IMARA_HOME, 'audit.db') },
        });

        child.on('error', (err) => {
          console.error(chalk.red(`Failed to start dashboard: ${err.message}`));
        });

        process.on('SIGINT', () => {
          child.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error(chalk.red(`Failed to start dashboard: ${err}`));
      }
    });
}
