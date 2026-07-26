import type { Metadata } from 'next';
import '@agent-studio/ui/styles.css';

export const metadata: Metadata = {
  title: 'Agent Studio App',
  description: 'Hosted agent application runtime',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh' }}>{children}</body>
    </html>
  );
}
