# Snippt

AI clipping engine: ingest long-form video → transcribe → score clip-worthy moments →
auto-cut/caption to vertical → track posts and earnings. Plan of record: `SNIPPT-MVP.md`.

## Setup

```bash
npm install
cp .env.example .env   # fill in ELEVENLABS_API_KEY (Scribe needs 'Speech to Text' permission)
```

## Phase 1 — Ingest + Transcribe

```bash
npm run ingest -- --file ./podcast.mp4
# or, with yt-dlp installed:
npm run ingest -- --url "https://www.youtube.com/watch?v=..."
```

Output: `./transcripts/<name>-<timestamp>.json` with full text + word-level timestamps
(the exact shape the `transcripts.word_timestamps` column expects — see
`migrations/001_snippt_mvp.sql`).

**Phase 1 gate:** one 20–30 min video → >95% readable transcript, spot-checked in 3
sections. Phase 2 (LLM moment scoring) does not start until this passes.

---

## Avatar pipeline (Phase 0 — frozen, future Phase 5 add-on)

The original VidForge avatar pipeline is preserved untouched and still runnable:

```bash
npm run avatars                                  # generate 10 stock personas on fal.ai (~$0.25)
npm run render -- --image ./avatars/maya.png     # script → ElevenLabs TTS → Kling lip-sync → mp4
```

Requires `FAL_KEY` in `.env`. Quality control: reject any generated avatar with an open
mouth or hands in frame and re-run (new seeds each run). Cost ≈ $1.80 per 30s render
(Kling v2 Standard); set `AVATAR_MODEL=fal-ai/bytedance/omnihuman` for the premium tier.

**Honest status:** neither pipeline has passed its smoke test yet — cloud sessions in this
environment currently block `api.elevenlabs.io` and `fal.run` (fix in environment network
settings, or run locally).
