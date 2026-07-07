# Snippt — MVP Brief (formerly VidForge)

**Status:** Pre-build planning doc for Claude Code
**Rule:** NO BREAKING CHANGES to existing Phase 0 pipeline (fal.ai + ElevenLabs + Kling avatar). That code stays intact and functional. Everything below is additive — new modules, new routes, new tables. Do not refactor or delete Phase 0 files without an explicit instruction.

---

## 1. Positioning Shift

**Old thesis (VidForge):** AI avatar video generator competing with Creatify/HeyGen.
**New thesis (Snippt):** AI clipping engine — ingest long-form video, auto-detect the clip-worthy moments, cut/caption/reformat them, distribute across platforms, and track earnings/attribution with more trust and clarity than Whop/Vyro/ClipAffiliates.

The avatar generation pipeline (Kling) does not go away — it becomes an optional creative add-on for clippers who want to insert a synthetic host/reaction layer on top of clips. It is no longer the core product.

**Core product loop:**
Ingest → Transcribe → Score moments → Auto-cut → Caption/reformat → Distribute → Track views/earnings

---

## 2. Phase Gates

Each phase must pass its smoke test before the next phase begins. This mirrors the Sycado/VidForge discipline already in place — no capability is marketed as LIVE without a live test passing.

### Phase 0 — ALREADY COMPLETE, DO NOT TOUCH
fal.ai + ElevenLabs + Kling Avatar pipeline. Two Node ESM scripts exist (`src/generate-avatars.mjs`, `src/render.mjs`). Leave as-is. This becomes the "Avatar Add-On" module later (Phase 5+).

> **HONEST-STATUS annotation (2026-07-07, per §6):** "complete" here means the code is
> written, syntax-checked, and frozen — the gate render itself has NOT yet completed
> successfully (cloud environment network policy blocked fal.ai). The avatar smoke test
> remains outstanding and is deferred with the rest of the Phase 5 add-on.

### Phase 1 — Ingest + Transcribe (new)
**Goal:** Take a long-form video URL or upload, produce a clean timestamped transcript.

- Input: YouTube URL, direct upload (mp4), or Twitch VOD link
- Extract audio via ffmpeg
- Transcribe via ElevenLabs Scribe (you already have this skill/API access) — word-level timestamps required for accurate cutting later
- Store transcript + timestamps in Supabase (`transcripts` table: `id`, `source_video_id`, `text`, `word_timestamps` jsonb, `created_at`)
- **Smoke test:** Upload one 20-30 min podcast/stream, get back a full timestamped transcript with >95% readable accuracy. Jason confirms manually by spot-checking 3 sections.
- **Do not proceed to Phase 2 until this passes.**

### Phase 2 — Moment Scoring (new, the core differentiator)
**Goal:** Score the transcript for clip-worthy moments — this is the "virality score" layer.

- Send transcript in chunks to OpenRouter (reuse existing `lib/router.ts` / `lib/model-registry.ts` pattern from Sycado if applicable, otherwise build a lightweight equivalent here)
- Prompt the LLM to identify candidate clips: start/end timestamps, a 0-100 "hook score," and a one-line reason (emotional peak, quotable line, controversial take, punchline, actionable insight)
- Output: ranked list of 5-15 candidate clips per source video
- Store in `clip_candidates` table: `id`, `transcript_id`, `start_ts`, `end_ts`, `hook_score`, `reason`, `status` (pending/approved/rejected)
- **No auto-posting yet.** Human (Jason or test clipper) reviews and approves candidates in this phase.
- **Smoke test:** Run scoring on the same test video from Phase 1. Manually review the top 5 candidates — do they actually feel clip-worthy? If 3+ of 5 are genuinely good, pass.

### Phase 3 — Auto-Cut + Caption (new)
**Goal:** Turn an approved clip candidate into a finished vertical video file.

- ffmpeg cuts the source video at `start_ts`/`end_ts`
- Reformat to 9:16 vertical (crop/pad logic — face-tracking is a stretch goal, not MVP-required)
- Burn in captions using the word-level timestamps from Phase 1 (no need to re-transcribe)
- Output stored in Supabase Storage or equivalent, linked in `clips` table: `id`, `clip_candidate_id`, `file_url`, `duration_seconds`, `created_at`
- **Smoke test:** One approved candidate goes end-to-end into a finished, captioned, vertical .mp4 that Jason can open and watch. Captions must be readable and synced.

### Phase 4 — Manual Distribution + Tracking (new, MVP finish line)
**Goal:** Get a clip posted and start tracking its performance. This is the MVP completion point — do not build auto-posting or the full CPM marketplace yet.

- Dashboard page listing finished clips with a "Mark as Posted" button — Jason/clipper manually posts to TikTok/Reels/Shorts and pastes the post URL back in
- Manual view-count refresh (paste current view count, timestamped) — no live API scraping required for MVP
- Simple earnings calculator: views × CPM rate (manually entered per campaign) = estimated earnings
- `posted_clips` table: `id`, `clip_id`, `platform`, `post_url`, `views_snapshot` jsonb (array of {timestamp, views}), `cpm_rate`, `created_at`
- **Smoke test:** One real clip posted to one real platform, tracked manually for 48 hours, earnings calculation matches manual math. Jason types "SNIPPT MVP LIVE" on pass — matching the Sycado convention.

---

## 3. What Is Explicitly OUT of MVP scope (future phases, not now)

- Auto-posting/API integration with TikTok/Instagram/YouTube (Phase 5+)
- Live view-count API tracking (Phase 5+)
- Marketplace / multi-sided brand-clipper campaign system like ClipAffiliates (Phase 6+)
- Fraud detection / bot-view filtering (Phase 6+)
- Face-tracking auto-crop for vertical reformat (nice-to-have, not blocking)
- Kling avatar overlay integration into clips (Phase 5+, reuses Phase 0 code untouched)
- Multi-language dubbing (later)

Keeping these out is intentional — the MVP proves the core loop (ingest → score → cut → caption → track) works end-to-end with a human in the loop at each gate, before automating any of it.

The post-MVP direction (retention-curve prediction, cross-video pattern memory, canvas
boards, hook A/B variants, loop-optimized editing, watch-time feedback into scoring)
lives in `WATCH-TIME-CANVAS.md`. It changes nothing above; the MVP data model already
leaves the seams it needs (e.g. `posted_clips.watch_time_snapshot`).

---

## 4. Tech Stack (confirmed, reusing what's already decided)

- Next.js App Router
- Supabase (transcripts, clip_candidates, clips, posted_clips tables — new, additive)
- OpenRouter for LLM scoring
- ElevenLabs for transcription (Scribe)
- ffmpeg for cutting/captioning/reformatting
- fal.ai + Kling — retained, untouched, deferred to Phase 5 avatar add-on
- Stripe — deferred until there's a paid tier to sell (post-MVP)

---

## 5. Naming / Branding Note

Product is now **Snippt**. Update UI copy, package.json name, and any user-facing strings — but do NOT rename internal file paths, repo name, or env vars mid-build unless Jason explicitly says so, to avoid breaking the working Phase 0 pipeline. Cosmetic rename only until Phase 4 passes.

---

## 6. Honesty Rule (carried over from Sycado discipline)

No phase is marked complete or "live" without its smoke test passing. No feature is described to anyone (including in this doc, future docs, or marketing copy) as working unless it has been tested end-to-end. This doc itself should be updated in place as phases pass — mark each phase header with ✅ DONE (date) once its smoke test is confirmed by Jason.
