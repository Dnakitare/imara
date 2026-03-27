import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { SqliteAuditStore } from '@imara/store';

function getDbPath(): string {
  return process.env.IMARA_DB_PATH ?? join(homedir(), '.imara', 'audit.db');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  // Bound query parameters to prevent DoS
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 500);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);
  const toolName = searchParams.get('tool')?.slice(0, 256) ?? undefined;
  const serverName = searchParams.get('server')?.slice(0, 256) ?? undefined;
  const decision = searchParams.get('decision')?.slice(0, 20) ?? undefined;
  const sessionId = searchParams.get('session')?.slice(0, 256) ?? undefined;

  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    return NextResponse.json({ events: [], total: 0, sessions: [], stats: { total: 0, allowed: 0, denied: 0, escalated: 0, flagged: 0, avgLatency: 0 }, isDemo: false });
  }

  let store: SqliteAuditStore | undefined;
  try {
    store = new SqliteAuditStore(dbPath);
    const events = store.query({
      limit,
      offset,
      toolName,
      serverName,
      policyDecision: decision,
      sessionId,
    });
    const total = store.getEventCount();
    const sessions = store.getSessionIds();

    // Use a bounded window for stats computation
    const statsWindow = store.query({ limit: 1000 });
    const stats = {
      total: statsWindow.length,
      allowed: statsWindow.filter(e => e.policyDecision === 'allow').length,
      denied: statsWindow.filter(e => e.policyDecision === 'deny').length,
      escalated: statsWindow.filter(e => e.policyDecision === 'escalate').length,
      flagged: statsWindow.filter(e =>
        e.policiesEvaluated.some((p: string) => p !== 'log-all')
      ).length,
      avgLatency: Math.round(
        statsWindow.filter(e => e.resultLatencyMs != null)
          .reduce((sum: number, e: any) => sum + (e.resultLatencyMs ?? 0), 0) /
        (statsWindow.filter(e => e.resultLatencyMs != null).length || 1)
      ),
    };

    const isDemo = total <= 40 && statsWindow.length > 0 && statsWindow.every((e: any) => e.sessionId === statsWindow[0]?.sessionId);

    return NextResponse.json({ events, total, sessions, stats, isDemo });
  } catch {
    return NextResponse.json(
      { error: 'Failed to query events' },
      { status: 500 }
    );
  } finally {
    store?.close();
  }
}
