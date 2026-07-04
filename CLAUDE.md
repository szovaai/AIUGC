# VidForge — AI UGC Video SaaS

Solo-builder SaaS: script → ElevenLabs TTS → fal.ai avatar lip-sync → MP4 ad videos
for ecom sellers. Full architecture, data model, pricing, and phases live in `PLAN.md`.
Read `PLAN.md` before doing any work in this repo.

## Non-negotiable rules

1. **Follow PLAN.md phase gates. They are binary.**
   - No Phase 1 (Supabase/Edge Functions/UI) work until the Phase 0 gate passes:
     one successful end-to-end render (script → TTS → avatar lip-sync → mp4).
   - No Phase 2 work until the Phase 1 gate passes: 10 consecutive clean renders,
     zero manual intervention.
2. **HONEST-STATUS discipline.** Nothing is claimed LIVE, working, or done without a
   real end-to-end smoke test (real render, real Stripe test charge). If it hasn't
   been smoke-tested, say so explicitly.
3. **Stock avatars only until Phase 4.** No custom photo-upload avatars — that is the
   deepfake abuse vector and stays gated behind a consent + moderation flow, post-revenue.
4. **Never commit secrets.** Keys go in `.env` (gitignored). If a key appears in a
   diff, stop and remove it.
5. **Credits are debited at enqueue and refunded on FAILED.** Never charge a user for
   a failed render.

## Current state

- **Phase:** 0 (pipeline proof)
- **Stack right now:** plain Node scripts (`src/`), no framework yet
- `npm run avatars` — generate the stock avatar library on fal.ai
- `npm run render -- --image ./avatars/<name>.png` — run the full pipeline gate
- Requires `FAL_KEY` and `ELEVENLABS_API_KEY` in `.env` (see `.env.example`)

## Conventions (from Phase 1 onward)

- Next.js 14 App Router + Supabase (Postgres, Auth, Storage, RLS) — see PLAN.md §3–§5
- All external providers behind an adapter layer (`lib/render-providers.ts`) so model
  swaps are config changes, not rewrites
- Every render-job state transition writes a `job_events` row — no silent failures
