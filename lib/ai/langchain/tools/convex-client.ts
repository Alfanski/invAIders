import { ConvexHttpClient } from 'convex/browser';

let cachedClient: ConvexHttpClient | undefined;

export function getConvexClient(): ConvexHttpClient {
  if (cachedClient) return cachedClient;

  const url = process.env['CONVEX_URL'];
  if (!url) throw new Error('CONVEX_URL environment variable is not set');

  cachedClient = new ConvexHttpClient(url);
  return cachedClient;
}
