import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Imara Dashboard',
  description: 'Agent governance audit trail',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">Imara</h1>
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-white">
                Dashboard
              </span>
            </div>
            <nav className="flex gap-4 text-sm text-[var(--muted-foreground)]">
              <a href="/" className="hover:text-white transition-colors">Timeline</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
