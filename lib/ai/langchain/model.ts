import { ChatGoogle } from '@langchain/google/node';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface ModelOptions {
  model?: string | undefined;
  temperature?: number | undefined;
  maxOutputTokens?: number | undefined;
}

export function createGeminiModel(options: ModelOptions = {}): ChatGoogle {
  const apiKey = process.env['GOOGLE_API_KEY'];
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  return new ChatGoogle({
    model: options.model ?? DEFAULT_MODEL,
    apiKey,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
  });
}
