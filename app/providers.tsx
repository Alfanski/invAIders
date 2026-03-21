'use client';

import type { ReactNode } from 'react';

import { ConvexClientProvider } from '@/components/providers/convex-client-provider';

export function Providers({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
