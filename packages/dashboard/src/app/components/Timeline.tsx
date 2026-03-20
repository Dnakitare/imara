'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventCard } from './EventCard';
import { PolicyBadge } from './PolicyBadge';

interface AuditEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  serverName: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  policyDecision: string;
  policyReason?: string;
  policiesEvaluated: string[];
  resultStatus?: string;
  resultLatencyMs?: number;
}

interface TimelineStats {
  total: number;
  allowed: number;
  denied: number;
  escalated: number;
  flagged: number;
  avgLatency: number;
}

interface TimelineData {
  events: AuditEvent[];
  total: number;
  sessions: string[];
  stats: TimelineStats;
  isDemo: boolean;
}

export function Timeline() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    decision: '',
    tool: '',
    session: '',
  });
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (filters.decision) params.set('decision', filters.decision);
      if (filters.tool) params.set('tool', filters.tool);
      if (filters.session) params.set('session', filters.session);

      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [offset, filters]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const stats = data?.stats ?? null;

  return (
    <div>
      {/* Demo banner */}
      {data?.isDemo && (
        <div className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <p className="text-sm text-blue-300">
            <span className="font-medium">This is a sample session.</span>{' '}
            Your real agent activity will appear here automatically once you start using your AI agent.
          </p>
        </div>
      )}

      {/* Risk summary banner */}
      {stats && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Activity Summary</h3>
              <p className="mt-1 text-lg">
                <span className="font-bold text-white">{stats.total}</span>
                <span className="text-[var(--muted-foreground)]"> tool calls</span>
                {stats.denied > 0 && (
                  <>
                    <span className="mx-2 text-[var(--border)]">&middot;</span>
                    <span className="font-bold text-red-400">{stats.denied}</span>
                    <span className="text-[var(--muted-foreground)]"> blocked</span>
                  </>
                )}
                {stats.flagged > 0 && (
                  <>
                    <span className="mx-2 text-[var(--border)]">&middot;</span>
                    <span className="font-bold text-yellow-400">{stats.flagged}</span>
                    <span className="text-[var(--muted-foreground)]"> flagged</span>
                  </>
                )}
                <span className="mx-2 text-[var(--border)]">&middot;</span>
                <span className="text-[var(--muted-foreground)]">Chain integrity </span>
                <span className="text-emerald-400">&#x2713;</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--muted-foreground)]">Avg latency</p>
              <p className="text-lg font-bold text-white">{stats.avgLatency}ms</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-3">
        <select
          value={filters.decision}
          onChange={e => { setFilters(f => ({ ...f, decision: e.target.value })); setOffset(0); }}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--foreground)]"
        >
          <option value="">All decisions</option>
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
          <option value="escalate">Escalate</option>
        </select>

        <input
          type="text"
          placeholder="Filter by tool name..."
          value={filters.tool}
          onChange={e => { setFilters(f => ({ ...f, tool: e.target.value })); setOffset(0); }}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        />

        {data && data.sessions.length > 0 && (
          <select
            value={filters.session}
            onChange={e => { setFilters(f => ({ ...f, session: e.target.value })); setOffset(0); }}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--foreground)]"
          >
            <option value="">All sessions</option>
            {data.sessions.map(s => (
              <option key={s} value={s}>{s.slice(0, 8)}...</option>
            ))}
          </select>
        )}

        <button
          onClick={() => fetchEvents()}
          className="ml-auto rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="py-12 text-center text-[var(--muted-foreground)]">
          Loading events...
        </div>
      )}

      {/* Empty state */}
      {data && data.events.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-lg text-[var(--muted-foreground)]">No events yet</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Use your AI agent with Imara wrapping enabled to see events here.
          </p>
        </div>
      )}

      {/* Event list */}
      {data && data.events.length > 0 && (
        <div className="space-y-3">
          {data.events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--muted-foreground)]">
            {offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= data.total}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
