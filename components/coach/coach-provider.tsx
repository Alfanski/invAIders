'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: number;
}

interface CoachContextValue {
  isOpen: boolean;
  mode: 'voice' | 'chat';
  messages: readonly CoachMessage[];
  isProcessing: boolean;
  open: () => void;
  close: () => void;
  setMode: (mode: 'voice' | 'chat') => void;
  addUserMessage: (text: string) => void;
  addCoachMessage: (text: string) => void;
  setProcessing: (v: boolean) => void;
}

const CoachContext = createContext<CoachContextValue | null>(null);

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${String(messageIdCounter)}`;
}

export function CoachProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isProcessing, setProcessing] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text, timestamp: Date.now() }]);
  }, []);

  const addCoachMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'coach', text, timestamp: Date.now() }]);
  }, []);

  const value = useMemo(
    (): CoachContextValue => ({
      isOpen,
      mode,
      messages,
      isProcessing,
      open,
      close,
      setMode,
      addUserMessage,
      addCoachMessage,
      setProcessing,
    }),
    [isOpen, mode, messages, isProcessing, open, close, addUserMessage, addCoachMessage],
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach(): CoachContextValue {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error('useCoach must be used within CoachProvider');
  return ctx;
}
