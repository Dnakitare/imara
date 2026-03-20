import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { SqliteAuditStore } from '@imara/store';
import { getDefaultPolicyYaml } from '@imara/policy';
import { seedDemoData } from '../seed.js';
import {
  IMARA_HOME,
  IMARA_CONFIG,
  IMARA_DB,
  IMARA_POLICIES_DIR,
  IMARA_DEFAULT_POLICY,
  IMARA_BACKUPS_DIR,
} from '../paths.js';

export async function runSetup(): Promise<void> {
  console.log();
  console.log(chalk.bold('  Imara') + chalk.gray(' — runtime governance for AI agents'));
  console.log();

  // Step 1: Auto-init if needed
  const alreadyInitialized = existsSync(IMARA_HOME);
  if (!alreadyInitialized) {
    mkdirSync(IMARA_HOME, { recursive: true });
    mkdirSync(IMARA_POLICIES_DIR, { recursive: true });
    mkdirSync(IMARA_BACKUPS_DIR, { recursive: true });

    const config = {
      version: '0.1.0',
      store: { type: 'sqlite', path: IMARA_DB },
      policies: { directory: IMARA_POLICIES_DIR },
    };
    writeFileSync(IMARA_CONFIG, JSON.stringify(config, null, 2));
    writeFileSync(IMARA_DEFAULT_POLICY, getDefaultPolicyYaml());
    console.log(chalk.green('  ✓') + ' Initialized ~/.imara/');
  } else {
    console.log(chalk.green('  ✓') + ' ~/.imara/ already configured');
  }

  // Step 2: Initialize DB + seed demo data if empty
  const store = new SqliteAuditStore(IMARA_DB);
  const isFirstRun = store.getEventCount() === 0;
  if (isFirstRun) {
    seedDemoData(store);
    console.log(chalk.green('  ✓') + ' Loaded demo session (38 events)');
  }
  store.close();

  // Step 3: Auto-wrap MCP config if we can find one
  const mcpConfigLocations = [
    join(process.cwd(), '.mcp.json'),
    join(homedir(), '.claude.json'),
  ];
  if (process.platform === 'darwin') {
    mcpConfigLocations.push(
      join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    );
  }

  const mcpConfigPath = mcpConfigLocations.find(p => existsSync(p));
  if (mcpConfigPath) {
    try {
      const raw = readFileSync(mcpConfigPath, 'utf-8');
      const config = JSON.parse(raw);
      const servers = config.mcpServers ?? {};
      const alreadyWrapped = Object.values(servers).every((s: any) =>
        s.args?.includes('imara') && s.args?.includes('proxy')
      );

      if (alreadyWrapped) {
        console.log(chalk.green('  ✓') + ` MCP servers already wrapped`);
      } else {
        // Backup
        mkdirSync(IMARA_BACKUPS_DIR, { recursive: true });
        const backupPath = join(IMARA_BACKUPS_DIR, `mcp-config-${Date.now()}.json`);
        copyFileSync(mcpConfigPath, backupPath);

        // Wrap
        let wrappedCount = 0;
        for (const [name, server] of Object.entries(servers) as [string, any][]) {
          if (server.args?.includes('imara') && server.args?.includes('proxy')) continue;

          const downstreamArgs = server.args?.join(',') ?? '';
          servers[name] = {
            command: 'npx',
            args: [
              'imara', 'proxy',
              '--downstream-command', server.command,
              '--downstream-args', downstreamArgs,
              '--server-name', name,
            ],
            ...(server.env ? { env: server.env } : {}),
          };
          wrappedCount++;
        }

        config.mcpServers = servers;
        writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + '\n');
        console.log(chalk.green('  ✓') + ` Wrapped ${wrappedCount} MCP server(s)`);
      }
    } catch {
      console.log(chalk.yellow('  ○') + ' Could not auto-wrap MCP config');
    }
  } else {
    console.log(chalk.yellow('  ○') + ' No MCP config found (run `imara wrap --config <path>` later)');
  }

  // Step 4: Print summary and open dashboard
  console.log();
  console.log(chalk.green('  ✓') + ` Dashboard: ${chalk.cyan('http://localhost:3838')}`);
  console.log();

  if (isFirstRun) {
    console.log(chalk.gray('  A demo session is loaded so you can explore the dashboard.'));
    console.log(chalk.gray('  Your real agent activity will appear automatically.'));
  } else {
    console.log(chalk.gray('  Your agent activity is being recorded.'));
  }

  console.log();
  console.log(chalk.gray('  imara status     See what\'s being monitored'));
  console.log(chalk.gray('  imara unwrap     Remove Imara and restore original config'));
  console.log();

  // Launch dashboard
  const dashboardDir = join(
    new URL('../../..', import.meta.url).pathname,
    'dashboard'
  );

  if (existsSync(dashboardDir)) {
    const child = spawn('npx', ['next', 'start', '-p', '3838'], {
      cwd: dashboardDir,
      stdio: 'pipe',
      env: { ...process.env, IMARA_DB_PATH: IMARA_DB },
    });

    // Wait a moment for server to start, then open browser
    setTimeout(() => {
      const openCmd = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(openCmd, ['http://localhost:3838'], { stdio: 'ignore' });
    }, 2000);

    // Keep running until user kills it
    process.on('SIGINT', () => {
      child.kill();
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});
  } else {
    console.log(chalk.yellow('  Dashboard not built. Run: pnpm build'));
  }
}
