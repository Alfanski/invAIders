import { NextRequest, NextResponse } from 'next/server';

/**
 * GET — Strava subscription validation (hub challenge).
 * Strava sends hub.mode, hub.verify_token, hub.challenge as query params.
 * Must respond 200 + JSON { "hub.challenge": "..." } within 2 seconds.
 */
export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env['STRAVA_WEBHOOK_VERIFY_TOKEN']) {
    console.log('[strava-webhook] Subscription verified');
    return NextResponse.json({ 'hub.challenge': challenge });
  }

  console.warn('[strava-webhook] Verification failed — token mismatch or missing params');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

interface StravaWebhookEvent {
  object_type: string;
  object_id: number;
  aspect_type: string;
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, string>;
}

/**
 * POST — Strava webhook event.
 * Must return 200 within 2 seconds; forward to n8n asynchronously.
 */
export async function POST(request: NextRequest) {
  const event = (await request.json()) as StravaWebhookEvent;

  console.log('[strava-webhook] Event received:', JSON.stringify(event));

  // Only forward activity-create events to n8n
  if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
    console.log(`[strava-webhook] Ignoring ${event.object_type}/${event.aspect_type}`);
    return NextResponse.json({ status: 'ignored' });
  }

  const n8nUrl = process.env['N8N_STRAVA_WEBHOOK_URL'];
  if (!n8nUrl) {
    console.error('[strava-webhook] N8N_STRAVA_WEBHOOK_URL not configured');
    return NextResponse.json({ status: 'accepted (n8n not configured)' });
  }

  // Fire-and-forget: don't await so we return 200 to Strava quickly.
  // Use .catch to avoid unhandled rejection crashes.
  void fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stravaActivityId: String(event.object_id),
      ownerId: String(event.owner_id),
      eventTime: event.event_time,
    }),
  }).catch((err: unknown) => {
    console.error('[strava-webhook] Failed to forward to n8n:', err);
  });

  return NextResponse.json({ status: 'accepted' });
}
