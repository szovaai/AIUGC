# Watch Time Canvas — Snippt Vision Doc (post-MVP)

**Status:** Vision layer on top of `SNIPPT-MVP.md`. Nothing here changes the MVP phase
gates. This doc exists so post-MVP work has a north star and so MVP code leaves the
right seams open. Do not build any of this before "SNIPPT MVP LIVE" (Phase 4 gate).

**Thesis:** Crayo is a volume factory with no memory (every upload is a blank slate).
Poppy is a research brain with no clipping/distribution engine. Both optimize for the
wrong metric — view count. Snippt's wedge is **watch time**: a living canvas where every
source video is a node, every clip a child node, and the AI learns across the whole
library from actual retention performance.

---

## The six innovations, mapped to phases

### 1. Retention-curve prediction (Phase 5)
Not a 0–100 "viral score" — a predicted drop-off curve per clip: first-3-seconds bounce
point, mid-clip lull, whether the ending loops back to the hook (rewatch bait).
*MVP seam:* Phase 2 scoring output is structured jsonb, so extra prediction fields can
be added without schema churn.

### 2. Cross-video pattern memory (Phase 6)
Poppy's cross-referencing pointed at your own performance data: "your highest watch-time
clips open with a question," "clips under 34s retain 40% better in this niche."
Requires a library of tracked clips with real watch-time data — which is why the MVP
tracking tables capture watch time from day one (see seams below).

### 3. Canvas-based campaign boards (Phase 6, UI)
Source video as a node, clip candidates fanned out as connected child nodes with mini
retention-curve previews; drag two clips together to propose a stitched multi-hook
version. The MVP data model is already a tree (source_videos → transcripts →
clip_candidates → clips → posted_clips), so the canvas is a rendering of existing
relations, not a new backend.

### 4. Hook A/B variants per clip (Phase 5 — first post-MVP feature)
Three opening-hook variants per clip (question / bold claim / pattern-interrupt),
batch-exported and tagged as a watch-time experiment. Cheapest of the six to ship:
it's a prompt change in Phase 2 scoring plus a variant column on clips.

### 5. Loop-optimized editing by default (Phase 5)
Auto-detect whether the last ~2 seconds can be trimmed/reframed so the ending visually
rhymes with the opening — the biggest single lever for TikTok/Reels loop credit, and no
competitor does it automatically. Lands in the Phase 3 ffmpeg cut module as an optional
pass; MVP cut logic stays simple.

### 6. Watch-time leaderboard retraining the scorer (Phase 6 — the closed loop)
Actual watch-time data from posted clips feeds back into the Phase 2 moment-scoring
prompt as few-shot examples of what retained. This is the loop Crayo and Poppy both
leave open, and the moat: the tool gets better with every clip a user posts.

---

## Seams the MVP leaves open (already done or trivially additive)

- `posted_clips.watch_time_snapshot` jsonb — array of `{timestamp, avg_watch_seconds,
  completion_rate}` alongside `views_snapshot`. Manual paste in MVP (TikTok/YT Studio
  show these numbers), API-fed later. Feeds innovations #1, #2, #6.
- `clip_candidates.reason` + `hook_score` stay, but Phase 2's LLM output lands as
  structured jsonb so new fields (predicted curve, hook type) are additive.
- Word-level timestamps from Phase 1 are the substrate for #5 (loop detection needs to
  know where sentences start/end) — already required by the MVP.
- The node tree (source → candidates → clips → posts) is the canvas graph — no backend
  rework needed for #3.

## What this doc is NOT

Not a license to start any of it early. The MVP proves ingest → score → cut → caption →
track with a human at every gate. Every innovation above depends on data or modules the
MVP produces; skipping ahead builds the roof before the foundation. Honesty rule applies
here too: nothing in this doc is described as existing — none of it exists yet.
