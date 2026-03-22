/**
 * Minimal Gemini API client for Convex actions.
 * Uses the REST API directly via fetch (available in the default Convex runtime).
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiGenerateRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
  systemInstruction?: {
    parts: { text: string }[];
  };
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiCandidate {
  content: { parts: GeminiPart[] };
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { code: number; message: string };
}

export class GeminiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

function getApiKey(): string {
  const key = process.env['GEMINI_API_KEY'];
  if (!key) throw new Error('GEMINI_API_KEY environment variable is not set');
  return key;
}

/**
 * Gemini 2.5 models return thinking parts alongside the actual response.
 * Extract the last non-thought part's text.
 */
function extractResponseText(parts: GeminiPart[]): string | undefined {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !part.thought && part.text) return part.text;
  }
  return parts[0]?.text;
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
  const apiKey = getApiKey();
  const model = options?.model ?? DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const body: GeminiGenerateRequest = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxTokens ?? 2048,
    },
  };

  if (options?.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: options.systemPrompt }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GeminiError(res.status, `Gemini API ${String(res.status)}: ${text}`);
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.error) {
    throw new GeminiError(data.error.code, data.error.message);
  }

  const candidate = data.candidates?.[0];
  const text = candidate ? extractResponseText(candidate.content.parts) : undefined;
  if (!text) {
    throw new GeminiError(500, 'Gemini returned empty response');
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
  const apiKey = getApiKey();
  const model = options?.model ?? DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const body: GeminiGenerateRequest = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxTokens ?? 2048,
      responseMimeType: 'application/json',
    },
  };

  if (options?.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: options.systemPrompt }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GeminiError(res.status, `Gemini API ${String(res.status)}: ${text}`);
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.error) {
    throw new GeminiError(data.error.code, data.error.message);
  }

  const candidate = data.candidates?.[0];
  const text = candidate ? extractResponseText(candidate.content.parts) : undefined;
  if (!text) {
    throw new GeminiError(500, 'Gemini returned empty response');
  }

  return JSON.parse(text) as T;
}
