# IP-001i: Voice Debrief

**Status:** Implemented (MVP)
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.6

---

## ElevenLabs Integration

**API call:**

```http
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
xi-api-key: {ELEVENLABS_API_KEY}
Content-Type: application/json
Accept: audio/mpeg

{
  "text": "...",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.45,
    "similarity_boost": 0.75,
    "style": 0.2,
    "use_speaker_boost": true
  }
}
```

**Response:** Binary MP3 stream.

## Audio Pipeline (n8n)

```
Gemini -> voice_summary text -> n8n -> ElevenLabs API -> MP3 bytes
  -> Convex generateUploadUrl -> upload -> storageId
  -> patch analysis/weekly/form record with storageId
  -> set status: "complete"
```

## Three Debrief Types

| Type            | Source                         | Length   | Trigger                      |
| --------------- | ------------------------------ | -------- | ---------------------------- |
| Per-activity    | `analyses.voiceSummary`        | ~1-2 min | After each activity analysis |
| Weekly          | `weeklyAnalyses.voiceSummary`  | ~2-3 min | Weekly (cron or on-demand)   |
| Form assessment | `formAssessments.voiceSummary` | ~1-2 min | After backfill or weekly     |

## Text Preparation Rules (Gemini Contract)

- Output `voice_summary` as **spoken prose**, not bullet points
- Max 300 words (~1-2 min at ~150 wpm)
- Short sentences, natural pauses via commas
- Spell out abbreviations: "beats per minute" not "bpm", "kilometers" not "km"
- No emoji or special characters
- End with a clear closing line

## Convex File Storage

- External uploader path (n8n): use Convex `generateUploadUrl`, upload bytes to that URL, then persist returned `storageId`
- Internal Convex path (actions only): `ctx.storage.store(audioBlob)` returns `storageId`
- Playback path: `ctx.storage.getUrl(storageId)` returns temporary playback URL
- On URL expiry: re-query to get fresh URL
- No cleanup policy for MVP (keep all audio)

## Error Handling

| Failure            | Strategy                                                            |
| ------------------ | ------------------------------------------------------------------- |
| ElevenLabs 5xx/429 | Retry 3x; set `generating_audio` -> `error` + message               |
| Text too long      | Pre-validate character count; Gemini instructed to cap at 300 words |
| Upload fails       | Keep `voice_summary` text so user can trigger "Regenerate audio"    |

## Files to Create

| File                                | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `components/audio/voice-player.tsx` | Shared custom audio player                                  |
| `convex/voiceDebriefs.ts`           | Mutations: save debrief; Queries: get by activity/week/form |
| `convex/files.ts`                   | `getVoiceUrl(storageId)` query                              |
| `convex/formAssessments.ts`         | Form assessment + voice linkage                             |

## Implementation Sequence

1. Shared `VoicePlayer` component (HTML5 audio + shadcn Slider)
2. `convex/files.ts` -- `getVoiceUrl` query
3. n8n TTS sub-workflow (ElevenLabs call + Convex upload)
4. Wire per-activity debrief (end of analysis pipeline)
5. Wire weekly debrief (end of weekly analysis)
6. Wire form debrief (after form assessment)
7. Test URL expiry + re-query behavior
