import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { verifyChain } from '@imara/core';
import type { AuditEvent } from '@imara/core';
import { SqliteAuditStore } from '@imara/store';
import { IMARA_DB, IMARA_ANCHOR } from '../paths.js';

const PAGE_SIZE = 5000;

interface Anchor {
  head: string;
  count: number;
  verifiedAt: string;
}

/** Read the entire chain in append order, paging so large logs are fully covered. */
function readAllEvents(store: SqliteAuditStore): AuditEvent[] {
  const events: AuditEvent[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = store.getAllEvents(PAGE_SIZE, offset);
    events.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return events;
}

function readAnchor(): Anchor | undefined {
  if (!existsSync(IMARA_ANCHOR)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(IMARA_ANCHOR, 'utf-8'));
    if (typeof parsed.head === 'string' && typeof parsed.count === 'number') return parsed;
  } catch {
    // fall through — a corrupt anchor is treated as absent
  }
  return undefined;
}

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Verify the integrity of the audit hash chain')
    .action(async () => {
      if (!existsSync(IMARA_DB)) {
        console.error(chalk.red('Imara not initialized. Run: imara init'));
        process.exit(1);
      }

      const store = new SqliteAuditStore(IMARA_DB);
      const events = readAllEvents(store);

      if (events.length === 0) {
        console.log(chalk.yellow('No events to verify.'));
        store.close();
        return;
      }

      console.log(chalk.gray(`Verifying ${events.length} events...`));

      const result = verifyChain(events);

      if (!result.valid) {
        console.log(chalk.red(`✗ Hash chain broken${result.brokenAt !== undefined ? ` at event index ${result.brokenAt}` : ''}`));
        if (result.reason) console.log(chalk.red(`  ${result.reason}`));
        if (result.brokenAt !== undefined) {
          const broken = events[result.brokenAt];
          console.log(chalk.red(`  Event ID: ${broken.id}`));
          console.log(chalk.red(`  Timestamp: ${broken.timestamp}`));
          console.log(chalk.red(`  Tool: ${broken.toolName}`));
        }
        store.close();
        process.exit(1);
      }

      // The chain is internally consistent. Compare against the last-known-good
      // anchor so deletion, truncation, or rewrite of the previously verified
      // prefix is caught even though those rows would still hash-link cleanly.
      const anchor = readAnchor();
      if (anchor) {
        const prefixOk =
          events.length >= anchor.count &&
          events[anchor.count - 1]?.eventHash === anchor.head;
        if (!prefixOk) {
          console.log(chalk.red('✗ Audit log diverges from the recorded anchor (events truncated or rewritten).'));
          console.log(chalk.red(`  Anchored at ${anchor.count} events (head ${anchor.head.slice(0, 12)}…) on ${anchor.verifiedAt}`));
          console.log(chalk.red(`  Now ${events.length} events (head ${events[events.length - 1].eventHash.slice(0, 12)}…)`));
          console.log(chalk.gray('  The anchor was not updated. Investigate before re-baselining.'));
          store.close();
          process.exit(1);
        }
      }

      const head = events[events.length - 1].eventHash;
      writeFileSync(
        IMARA_ANCHOR,
        JSON.stringify({ head, count: events.length, verifiedAt: new Date().toISOString() }, null, 2),
        { mode: 0o600 }
      );

      console.log(chalk.green(`✓ Hash chain integrity verified (${events.length} events)`));
      if (anchor) {
        console.log(chalk.gray(`  Anchor advanced from ${anchor.count} to ${events.length} events.`));
      } else {
        console.log(chalk.gray(`  Anchor established at ${events.length} events.`));
      }

      store.close();
    });
}
