import { ChatOpenAI } from '@langchain/openai';

const DEFAULT_MODEL = 'qwen/qwen3-32b';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

export interface ModelOptions {
  model?: string | undefined;
  temperature?: number | undefined;
  maxOutputTokens?: number | undefined;
}

export function createModel(options: ModelOptions = {}): ChatOpenAI {
  const apiKey = process.env['GROQ_API_KEY'];
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }

  const baseURL = process.env['LLM_BASE_URL'] ?? DEFAULT_BASE_URL;

  return new ChatOpenAI({
    model: options.model ?? DEFAULT_MODEL,
    apiKey,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxOutputTokens !== undefined ? { maxTokens: options.maxOutputTokens } : {}),
    configuration: { baseURL },
  });
}
