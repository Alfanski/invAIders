'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { ConvexClientProvider } from '@/components/providers/convex-client-provider';

export function Providers({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ThemeProvider>
  );
}
