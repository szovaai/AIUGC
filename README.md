# VidForge — Phase 0 Pipeline

Proves the entire core product end-to-end, by hand, before any product code exists:

```
ad script (text) → ElevenLabs TTS → fal.ai avatar lip-sync → final .mp4
```

## Setup (5 minutes)

```bash
npm install
cp .env.example .env
# fill in FAL_KEY and ELEVENLABS_API_KEY
```

- fal key: https://fal.ai/dashboard/keys (you already have an account from the LoveLife image pipeline)
- ElevenLabs key: elevenlabs.io → profile → API Keys

## Step 1 — Generate your realistic avatar library

```bash
npm run avatars
```

Generates 10 original, photorealistic UGC-creator personas into `./avatars/` plus a
`manifest.json` (this later seeds your Supabase `avatars` table). Cost ≈ $0.25 total.

Quality control: open each image and reject anything with weird teeth, hands in frame,
or an open mouth (lip-sync models need a closed, neutral mouth as the base frame).
Re-run to regenerate — each run uses new seeds. Edit the `PERSONAS` array to add/change cast.

## Step 2 — Run the render gate

```bash
npm run render -- --image ./avatars/maya.png
```

Runs the default 15-second smoke-test script. For a real test with your own copy:

```bash
npm run render -- --image ./avatars/jordan.png --text "Your ad script here..."
# or from a file:
npm run render -- --image ./avatars/elena.png --script ./script.txt --voice <elevenlabs-voice-id>
```

Output lands in `./renders/render-<timestamp>.mp4`. Expect 1–5 minutes per render.

**Cost per 30s render:** ≈ $1.80 (Kling v2 Standard). Swap `AVATAR_MODEL` in `.env` to
`fal-ai/bytedance/omnihuman` for the premium tier (≈ $4.40/30s, better motion).

## The gates

- **Day-3 gate:** one successful end-to-end render. Lips sync, looks human → Phase 0 PASSED.
- **Phase 1 gate:** 10 consecutive clean renders, zero manual intervention.

## Voice → avatar mapping tips

Match voice age/energy to the persona (`voiceHint` in the manifest is your guide).
Browse voices at elevenlabs.io/voice-library; paste the voice ID with `--voice`.
Lock in one voice per avatar and record the pairing in `manifest.json` — that mapping
becomes the `avatars.voice_id` column in Phase 1.

## Notes

- Stock AI personas only. No uploads of real people's photos in this phase — custom
  avatars come in Phase 4 behind a consent + moderation gate.
- If a fal endpoint ever 404s (models get versioned), check fal.ai/explore for the
  current avatar endpoints and update `AVATAR_MODEL` — the code is model-agnostic.
- Every render is a real API charge. The default script is short on purpose.
