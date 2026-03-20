import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditEvent } from '@imara/core';
import type { AuditStore, EventQuery } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SqliteAuditStore implements AuditStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    // Try multiple possible locations for the migration file
    const possiblePaths = [
      join(__dirname, 'migrations', '001.sql'),
      join(__dirname, '..', 'src', 'migrations', '001.sql'),
      join(__dirname, '..', 'migrations', '001.sql'),
    ];

    let sql: string | undefined;
    for (const p of possiblePaths) {
      try {
        sql = readFileSync(p, 'utf-8');
        break;
      } catch {
        continue;
      }
    }

    if (!sql) {
      // Inline fallback migration
      sql = `
        CREATE TABLE IF NOT EXISTS events (
          id              TEXT PRIMARY KEY,
          timestamp       TEXT NOT NULL,
          session_id      TEXT,
          server_name     TEXT,
          agent_id        TEXT,
          tool_name       TEXT NOT NULL,
          tool_arguments  TEXT NOT NULL,
          tool_annotations TEXT,
          policy_decision TEXT NOT NULL DEFAULT 'allow',
          policy_reason   TEXT,
          policies_evaluated TEXT,
          result_status   TEXT,
          result_summary  TEXT,
          result_latency_ms INTEGER,
          prev_hash       TEXT,
          event_hash      TEXT NOT NULL,
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
        CREATE INDEX IF NOT EXISTS idx_events_tool ON events(tool_name);
        CREATE INDEX IF NOT EXISTS idx_events_decision ON events(policy_decision);
      `;
    }

    this.db.exec(sql);
  }

  append(event: AuditEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        id, timestamp, session_id, server_name, agent_id,
        tool_name, tool_arguments, tool_annotations,
        policy_decision, policy_reason, policies_evaluated,
        result_status, result_summary, result_latency_ms,
        prev_hash, event_hash
      ) VALUES (
        @id, @timestamp, @sessionId, @serverName, @agentId,
        @toolName, @toolArguments, @toolAnnotations,
        @policyDecision, @policyReason, @policiesEvaluated,
        @resultStatus, @resultSummary, @resultLatencyMs,
        @prevHash, @eventHash
      )
    `);

    stmt.run({
      id: event.id,
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      serverName: event.serverName,
      agentId: event.agentId ?? null,
      toolName: event.toolName,
      toolArguments: JSON.stringify(event.toolArguments),
      toolAnnotations: event.toolAnnotations ? JSON.stringify(event.toolAnnotations) : null,
      policyDecision: event.policyDecision,
      policyReason: event.policyReason ?? null,
      policiesEvaluated: JSON.stringify(event.policiesEvaluated),
      resultStatus: event.resultStatus ?? null,
      resultSummary: event.resultSummary ?? null,
      resultLatencyMs: event.resultLatencyMs ?? null,
      prevHash: event.prevHash,
      eventHash: event.eventHash,
    });
  }

  query(filter: EventQuery): AuditEvent[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.sessionId) {
      conditions.push('session_id = @sessionId');
      params.sessionId = filter.sessionId;
    }
    if (filter.serverName) {
      conditions.push('server_name = @serverName');
      params.serverName = filter.serverName;
    }
    if (filter.toolName) {
      conditions.push('tool_name = @toolName');
      params.toolName = filter.toolName;
    }
    if (filter.policyDecision) {
      conditions.push('policy_decision = @policyDecision');
      params.policyDecision = filter.policyDecision;
    }
    if (filter.fromTimestamp) {
      conditions.push('timestamp >= @fromTimestamp');
      params.fromTimestamp = filter.fromTimestamp;
    }
    if (filter.toTimestamp) {
      conditions.push('timestamp <= @toTimestamp');
      params.toTimestamp = filter.toTimestamp;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    const rows = this.db.prepare(
      `SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset }) as any[];

    return rows.map(this.rowToEvent);
  }

  getLatestHash(): string | null {
    const row = this.db.prepare(
      'SELECT event_hash FROM events ORDER BY created_at DESC, rowid DESC LIMIT 1'
    ).get() as any;
    return row?.event_hash ?? null;
  }

  getEventCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as any;
    return row.count;
  }

  getAllEvents(limit = 1000, offset = 0): AuditEvent[] {
    const rows = this.db.prepare(
      'SELECT * FROM events ORDER BY timestamp ASC LIMIT ? OFFSET ?'
    ).all(limit, offset) as any[];
    return rows.map(this.rowToEvent);
  }

  getSessionIds(): string[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT session_id FROM events WHERE session_id IS NOT NULL ORDER BY MIN(timestamp) DESC'
    ).all() as any[];
    return rows.map(r => r.session_id);
  }

  close(): void {
    this.db.close();
  }

  private rowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sessionId: row.session_id,
      serverName: row.server_name,
      agentId: row.agent_id ?? undefined,
      toolName: row.tool_name,
      toolArguments: JSON.parse(row.tool_arguments),
      toolAnnotations: row.tool_annotations ? JSON.parse(row.tool_annotations) : undefined,
      policyDecision: row.policy_decision,
      policyReason: row.policy_reason ?? undefined,
      policiesEvaluated: row.policies_evaluated ? JSON.parse(row.policies_evaluated) : [],
      resultStatus: row.result_status ?? undefined,
      resultSummary: row.result_summary ?? undefined,
      resultLatencyMs: row.result_latency_ms ?? undefined,
      prevHash: row.prev_hash,
      eventHash: row.event_hash,
    };
  }
}
