'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

import { getSuggestionsForRoute, getRouteContext } from '@/lib/coach/context-suggestions';
import { useVoiceInput } from '@/lib/coach/use-voice-input';

import { useCoach } from './coach-provider';
import type { CoachMessage } from './coach-provider';

interface CoachChatResponse {
  message: string;
  toolCallCount: number;
}

function extractActivityIdFromPath(pathname: string): string | undefined {
  const match = /^\/dashboard\/workout\/(.+)$/.exec(pathname);
  return match?.[1];
}

async function sendToCoachAPI(
  message: string,
  history: readonly CoachMessage[],
  route: string,
  routeDescription: string,
  activityId?: string,
): Promise<string> {
  const res = await fetch('/api/ai/coach-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, text: m.text })),
      context: { route, routeDescription, ...(activityId ? { activityId } : {}) },
    }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Your session has expired. Please sign out and sign in again.');
    }
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      typeof err['message'] === 'string'
        ? err['message']
        : `Coach API error (${String(res.status)})`,
    );
  }

  const data = (await res.json()) as CoachChatResponse;
  return data.message;
}

export function CoachPanel(): ReactNode {
  const { isOpen, close, messages, addUserMessage, addCoachMessage, isProcessing, setProcessing } =
    useCoach();
  const pathname = usePathname();
  const suggestions = getSuggestionsForRoute(pathname);
  const routeContext = getRouteContext(pathname);
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput();
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevTranscriptRef = useRef('');

  const activityId = extractActivityIdFromPath(pathname);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return;
      addUserMessage(text.trim());
      setProcessing(true);
      setChatError(null);
      try {
        const response = await sendToCoachAPI(
          text.trim(),
          messages,
          pathname,
          routeContext,
          activityId,
        );
        addCoachMessage(response);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setChatError(msg);
        addCoachMessage('Sorry, I had trouble processing that. Please try again.');
      } finally {
        setProcessing(false);
      }
    },
    [
      addUserMessage,
      addCoachMessage,
      isProcessing,
      setProcessing,
      messages,
      pathname,
      routeContext,
      activityId,
    ],
  );

  useEffect(() => {
    if (!isListening && transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      void sendMessage(transcript);
      resetTranscript();
    }
  }, [isListening, transcript, sendMessage, resetTranscript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isProcessing) return;
      void sendMessage(chatInput);
      setChatInput('');
    },
    [chatInput, sendMessage, isProcessing],
  );

  const handleSuggestion = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  if (!isOpen) return null;

  return (
    <div
      className="coach-panel-enter fixed bottom-4 left-4 right-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-glass-border shadow-2xl backdrop-blur-xl sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
      style={{ backgroundColor: 'var(--coach-panel-bg)', maxHeight: 'min(60vh, 520px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20">
            <svg
              className="h-3.5 w-3.5 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-glass-text">AI Coach</p>
            <p className="text-[9px] text-glass-text-dim">{routeContext}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-lg p-1 text-glass-text-muted transition-colors hover:bg-glass-hover hover:text-glass-text"
          aria-label="Close"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-glass-border/50 px-4 py-2.5 scrollbar-hide">
          {suggestions.map((s) => (
            <button
              key={s.text}
              type="button"
              onClick={() => {
                handleSuggestion(s.prompt);
              }}
              className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
            >
              {s.text}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 space-y-2.5 overflow-y-auto border-t border-glass-border/50 px-4 py-3"
        style={{ minHeight: messages.length > 0 ? '120px' : '60px' }}
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-xs text-glass-text-dim">
              Ask your coach anything -- type or tap the mic
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-glass-text-muted">
            <div className="coach-thinking flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </div>
            Thinking...
          </div>
        )}
        {chatError && !isProcessing && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-500 dark:text-red-300">
            {chatError}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-glass-border px-3 py-2.5">
        {isListening ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-accent/5 px-3 py-2 ring-1 ring-accent/60">
              <p className="min-h-[1.25rem] text-sm text-glass-text">
                {interimTranscript || transcript || (
                  <span className="text-glass-text-dim">Listening...</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleVoice}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
              aria-label="Stop listening"
            >
              <span className="absolute inset-0 animate-ping rounded-xl bg-accent/20" />
              <svg
                className="relative z-10 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                />
              </svg>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
              }}
              placeholder="Ask your coach..."
              className="flex-1 rounded-xl bg-glass px-3 py-2 text-sm text-glass-text placeholder-glass-text-dim outline-none ring-1 ring-glass-border transition-shadow focus:ring-accent/40"
            />
            {isSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-glass text-glass-text-muted transition-all hover:bg-glass-hover hover:text-glass-text"
                aria-label="Voice input"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={!chatInput.trim() || isProcessing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-opacity disabled:opacity-20"
              aria-label="Send message"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: Readonly<{ message: CoachMessage }>): ReactNode {
  const isCoach = message.role === 'coach';

  return (
    <div className={`flex ${isCoach ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
          isCoach
            ? 'border-l-2 border-accent/40 bg-glass text-glass-text'
            : 'bg-accent/20 text-glass-text'
        }`}
      >
        {isCoach && (
          <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-widest text-accent">
            Coach
          </p>
        )}
        <p className="whitespace-pre-line">{message.text}</p>
      </div>
    </div>
  );
}
