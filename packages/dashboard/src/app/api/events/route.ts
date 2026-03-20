import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SqliteAuditStore } from '@imara/store';

function getDbPath(): string {
  return process.env.IMARA_DB_PATH ?? join(homedir(), '.imara', 'audit.db');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const toolName = searchParams.get('tool') ?? undefined;
  const serverName = searchParams.get('server') ?? undefined;
  const decision = searchParams.get('decision') ?? undefined;
  const sessionId = searchParams.get('session') ?? undefined;

  try {
    const store = new SqliteAuditStore(getDbPath());
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

    // Get all events for stats (or recent window)
    const allRecent = store.query({ limit: 10000 });
    const stats = {
      total: allRecent.length,
      allowed: allRecent.filter(e => e.policyDecision === 'allow').length,
      denied: allRecent.filter(e => e.policyDecision === 'deny').length,
      escalated: allRecent.filter(e => e.policyDecision === 'escalate').length,
      flagged: allRecent.filter(e =>
        e.policiesEvaluated.some((p: string) => p !== 'log-all')
      ).length,
      avgLatency: Math.round(
        allRecent.filter(e => e.resultLatencyMs != null)
          .reduce((sum: number, e: any) => sum + (e.resultLatencyMs ?? 0), 0) /
        (allRecent.filter(e => e.resultLatencyMs != null).length || 1)
      ),
    };

    const isDemo = total <= 40 && allRecent.length > 0 && allRecent.every((e: any) => e.sessionId === allRecent[0]?.sessionId);

    store.close();

    return NextResponse.json({ events, total, sessions, stats, isDemo });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to query events', detail: String(err) },
      { status: 500 }
    );
  }
}
