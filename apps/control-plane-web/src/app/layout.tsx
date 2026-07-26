import type { Metadata } from 'next';
import '@agent-studio/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Studio',
  description: 'Define once. Govern centrally. Publish anywhere.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="brand">Agent Studio</div>
            <nav className="nav">
              <a href="/">Dashboard</a>
              <a href="/agents">Agents</a>
              <a href="/playground">Playground</a>
              <a href="/applications">Applications</a>
              <a href="/reviews">Reviews</a>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
