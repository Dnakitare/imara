interface PolicyBadgeProps {
  decision: string;
}

export function PolicyBadge({ decision }: PolicyBadgeProps) {
  const styles: Record<string, string> = {
    allow: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    deny: 'bg-red-500/15 text-red-400 border-red-500/30',
    escalate: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    log: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${styles[decision] ?? styles.log}`}
    >
      {decision}
    </span>
  );
}
