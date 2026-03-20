import { PolicyBadge } from './PolicyBadge';

interface EventCardProps {
  event: {
    id: string;
    timestamp: string;
    serverName: string;
    toolName: string;
    toolArguments: Record<string, unknown>;
    policyDecision: string;
    policyReason?: string;
    policiesEvaluated: string[];
    resultStatus?: string;
    resultLatencyMs?: number;
  };
}

export function EventCard({ event }: EventCardProps) {
  const time = new Date(event.timestamp);
  const timeStr = time.toLocaleTimeString();
  const dateStr = time.toLocaleDateString();
  const argsStr = JSON.stringify(event.toolArguments, null, 2);

  return (
    <div className="group rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PolicyBadge decision={event.policyDecision} />
            <span className="font-mono text-sm font-semibold text-white">
              {event.toolName}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              on {event.serverName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
            <span>{dateStr} {timeStr}</span>
            {event.resultLatencyMs != null && (
              <span>{event.resultLatencyMs}ms</span>
            )}
            {event.resultStatus && (
              <span className={
                event.resultStatus === 'success' ? 'text-emerald-400' :
                event.resultStatus === 'error' ? 'text-red-400' :
                'text-yellow-400'
              }>
                {event.resultStatus}
              </span>
            )}
          </div>

          {event.policyReason && event.policyDecision !== 'allow' && (
            <p className="mt-2 text-xs text-yellow-400/80">
              {event.policyReason}
            </p>
          )}

          {event.policiesEvaluated.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {event.policiesEvaluated.map(p => (
                <span key={p} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expandable arguments section */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-[var(--muted-foreground)] hover:text-white transition-colors">
          Arguments
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-300 font-mono leading-relaxed">
          {argsStr}
        </pre>
      </details>
    </div>
  );
}
