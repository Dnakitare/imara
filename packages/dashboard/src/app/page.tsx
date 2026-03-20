import { Timeline } from './components/Timeline';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Audit Timeline</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Real-time view of all agent tool calls, policy decisions, and results.
        </p>
      </div>
      <Timeline />
    </div>
  );
}
