# Snippt — AI Clipping Engine (repo formerly VidForge)

Solo-builder SaaS. Core loop: ingest long-form video → transcribe (ElevenLabs Scribe) →
LLM moment scoring → auto-cut/caption (ffmpeg) → manual distribution + earnings tracking.
The current plan of record is `SNIPPT-MVP.md` — read it before doing any work in this repo.
`WATCH-TIME-CANVAS.md` is the post-MVP vision (do not build from it before Phase 4 passes).
`PLAN.md` is the archived VidForge avatar-SaaS plan, kept because the avatar pipeline
returns as a deferred post-MVP add-on.

## Non-negotiable rules

1. **NO BREAKING CHANGES to the Phase 0 avatar pipeline.** `src/generate-avatars.mjs`,
   `src/render.mjs`, and their env vars stay intact. All Snippt work is additive —
   new modules, new routes, new tables. No refactors or deletions of Phase 0 files
   without an explicit instruction from Jason.
2. **Follow SNIPPT-MVP.md phase gates. They are binary.** No Phase 2 (moment scoring)
   work until the Phase 1 gate passes (20–30 min video → >95% readable timestamped
   transcript, spot-checked by Jason). Same discipline for every later phase.
3. **HONEST-STATUS discipline.** Nothing is claimed LIVE, working, or done without a
   real end-to-end smoke test. If it hasn't been smoke-tested, say so explicitly.
   Update SNIPPT-MVP.md phase headers with ✅ DONE (date) only on Jason's confirmation.
4. **Never commit secrets.** Keys live in `.env` (gitignored). If a key appears in a
   diff, stop and remove it.
5. **Stock avatars only** whenever the avatar add-on resurfaces (Phase 5+) — custom
   photo uploads stay gated behind consent + moderation, post-revenue.

## Honest status (update in place)

- **Phase 1 (ingest + transcribe):** `src/ingest.mjs` written and syntax-checked.
  NOT smoke-tested — this cloud environment's network policy blocks `api.elevenlabs.io`.
- **Phase 0 avatar pipeline (frozen):** scripts written and syntax-checked. The gate
  render never completed — same network block on `fal.run`. Deferred (post-MVP avatar add-on).
- **Supabase:** no project provisioned yet. `migrations/001_snippt_mvp.sql` is ready to
  apply; until then `ingest.mjs` writes transcripts to `./transcripts/*.json` locally.

## Commands

- `npm run ingest -- --file ./video.mp4` — Phase 1: extract audio, transcribe with
  word-level timestamps (`--url` works too if `yt-dlp` is on PATH)
- `npm run avatars` / `npm run render` — frozen Phase 0 avatar pipeline, do not modify
- Requires `ELEVENLABS_API_KEY` in `.env` (Scribe needs the key to have
  **Speech to Text** permission); Phase 0 additionally needs `FAL_KEY`

## Conventions

- Plain Node ESM scripts in `src/` for pipeline stages until the Next.js app lands (Phase 4)
- ffmpeg comes from `@ffmpeg-installer/ffmpeg` (npm-bundled binary) with system ffmpeg
  preferred when present — GitHub-release downloads are proxy-blocked in cloud sessions
- Supabase schema changes go in `migrations/*.sql`, additive and numbered
- External providers stay behind swappable seams; model choices are env-var config
