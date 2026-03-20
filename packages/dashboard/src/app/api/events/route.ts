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
    store.close();

    return NextResponse.json({ events, total, sessions });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to query events', detail: String(err) },
      { status: 500 }
    );
  }
}
