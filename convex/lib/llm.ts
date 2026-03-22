/**
 * Provider-agnostic LLM client using the OpenAI chat completions API format.
 * Works with any OpenAI-compatible API (Groq, OpenRouter, Together, etc.)
 * by configuring LLM_BASE_URL and LLM_API_KEY env vars.
 */

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

interface ChatCompletionChoice {
  message: { role: string; content: string | null };
  finish_reason: string;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  error?: { message: string; type: string; code: string };
}

export class LLMError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

function getConfig(): { apiKey: string; baseUrl: string; model: string } {
  const apiKey = process.env['LLM_API_KEY'] ?? process.env['GROQ_API_KEY'];
  if (!apiKey) throw new Error('LLM_API_KEY or GROQ_API_KEY environment variable is not set');
  const baseUrl = process.env['LLM_BASE_URL'] ?? DEFAULT_BASE_URL;
  const model = process.env['LLM_MODEL'] ?? DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export async function generateText(
  prompt: string,
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  },
): Promise<string> {
  const { apiKey, baseUrl, model: defaultModel } = getConfig();
  const model = options?.model ?? defaultModel;
  const url = `${baseUrl}/chat/completions`;

  const messages: ChatMessage[] = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const body: ChatCompletionRequest = {
    model,
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 2048,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LLMError(res.status, `LLM API ${String(res.status)}: ${text}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;

  if (data.error) {
    throw new LLMError(500, data.error.message);
  }

  const text = data.choices?.[0]?.message.content;
  if (!text) {
    throw new LLMError(500, 'LLM returned empty response');
  }

  return text;
}

export async function generateJSON<T>(
  prompt: string,
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  },
): Promise<T> {
  const { apiKey, baseUrl, model: defaultModel } = getConfig();
  const model = options?.model ?? defaultModel;
  const url = `${baseUrl}/chat/completions`;

  const messages: ChatMessage[] = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const body: ChatCompletionRequest = {
    model,
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 2048,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LLMError(res.status, `LLM API ${String(res.status)}: ${text}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;

  if (data.error) {
    throw new LLMError(500, data.error.message);
  }

  const text = data.choices?.[0]?.message.content;
  if (!text) {
    throw new LLMError(500, 'LLM returned empty response');
  }

  return JSON.parse(text) as T;
}
