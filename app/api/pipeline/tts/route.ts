import { type NextRequest, NextResponse } from 'next/server';

interface TtsRequestBody {
  secret?: string;
  text?: string;
  voiceId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

/**
 * POST — Proxy ElevenLabs TTS requests through Vercel.
 *
 * n8n Cloud's IPs are flagged by ElevenLabs' free-tier abuse detection,
 * so we proxy the call through Vercel whose IPs are not blocked.
 * Returns the raw audio/mpeg binary stream.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as TtsRequestBody;

  const secret = process.env['CONVEX_WEBHOOK_SECRET'];
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!body.text || !body.voiceId) {
    return NextResponse.json({ error: 'text and voiceId are required' }, { status: 400 });
  }

  const apiKey = process.env['ELEVENLABS_API_KEY'];
  if (!apiKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 });
  }

  const voiceSettings = body.voiceSettings ?? {
    stability: 0.45,
    similarity_boost: 0.75,
    style: 0.2,
    use_speaker_boost: true,
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${body.voiceId}`;

  const ttsResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: body.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: voiceSettings,
    }),
  });

  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text();
    console.error(`[tts-proxy] ElevenLabs error (${String(ttsResponse.status)}):`, errorText);
    return NextResponse.json(
      { error: 'ElevenLabs TTS failed', detail: errorText },
      { status: ttsResponse.status },
    );
  }

  const audioBuffer = await ttsResponse.arrayBuffer();

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBuffer.byteLength),
    },
  });
}
