import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'mAIcoach',
  description: 'AI fitness coaching dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <div className="bg-mesh" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
