'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface SessionContextValue {
  athleteId: string;
  stravaAthleteId: string;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue | null {
  return useContext(SessionContext);
}

export function useRequiredSession(): SessionContextValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useRequiredSession called outside SessionProvider');
  return session;
}

interface SessionProviderProps {
  athleteId: string;
  stravaAthleteId: string;
  children: ReactNode;
}

export function SessionProvider({
  athleteId,
  stravaAthleteId,
  children,
}: Readonly<SessionProviderProps>): ReactNode {
  return (
    <SessionContext.Provider value={{ athleteId, stravaAthleteId }}>
      {children}
    </SessionContext.Provider>
  );
}
