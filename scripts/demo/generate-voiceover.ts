import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://api.elevenlabs.io/v1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');

const VOICE_ID = 'dvGaQdQfwItvPEpQKy5y'; // Markus - Deep and Epic

const NARRATION = `You just crushed a workout. You upload it to Strava. What do you get? Kudos. A heart emoji. Maybe someone comments "nice one." But did you actually get better? Strava throws a wall of numbers at you -- splits, zones, power curves -- and leaves you to figure it out yourself. It's social media for athletes. Not coaching.

Now imagine this. Every workout you finish gets picked up automatically, analyzed by an AI that actually understands training, and turned into a personalized coaching debrief -- with a real voice walking you through it. No buttons. No waiting. That's mAIcoach.

Here's how it works. The moment you finish a workout on Strava, a webhook fires. Our n8n pipeline takes over -- it grabs your data, crunches the streams, sends them to an AI model for deep analysis, and generates a voice debrief. All of it happens in the background, completely hands-free.

This is your new home. A clean, focused dashboard built on Convex and Vercel. Your fitness trends, fatigue levels, training load -- all in one place. No feed. No distractions. Just the numbers that actually matter for getting faster and staying healthy.

Got a question? Ask your coach. It knows your entire training history, your current fitness, your goals. Ask it if you're pushing too hard. Ask it what to do tomorrow. It's like having a coach in your pocket -- except this one's available at 2 AM.

Every workout. Analyzed. Every session. Debriefed. No more scrolling for validation. No more guessing if you're on track. mAIcoach. Train for coach, not kudos.`;

async function main() {
  console.log('=== mAIcoach Demo Voiceover Generator ===\n');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set in environment');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Voice: Markus - Deep and Epic (${VOICE_ID})`);
  console.log(`Text length: ${NARRATION.length} characters`);
  console.log('Generating narration audio...\n');

  const res = await fetch(`${API_BASE}/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: NARRATION,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.85,
        style: 0.7,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS generation failed (${res.status}): ${body}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  const outputPath = path.join(OUTPUT_DIR, 'narration.mp3');
  fs.writeFileSync(outputPath, audioBuffer);

  const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`Done! Saved to: ${outputPath} (${sizeMB} MB)`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
