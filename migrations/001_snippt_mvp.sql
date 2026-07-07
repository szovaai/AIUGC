-- 001_snippt_mvp.sql — Snippt MVP data model (SNIPPT-MVP.md §2, additive only)
-- Apply via the Supabase SQL editor or `supabase db push` once a Supabase project exists.
-- RLS is intentionally deferred: the MVP dashboard (Phase 4) is single-user; policies
-- get added when auth lands. `word_timestamps` shape matches src/ingest.mjs output.

create extension if not exists pgcrypto;

create table if not exists source_videos (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('youtube', 'upload', 'twitch')),
  source_url text,
  file_url text,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  source_video_id uuid references source_videos(id) on delete cascade,
  text text not null,
  word_timestamps jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists clip_candidates (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts(id) on delete cascade,
  start_ts numeric not null,
  end_ts numeric not null,
  hook_score int not null check (hook_score between 0 and 100),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  clip_candidate_id uuid not null references clip_candidates(id) on delete cascade,
  file_url text not null,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create table if not exists posted_clips (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips(id) on delete cascade,
  platform text not null,
  post_url text,
  views_snapshot jsonb not null default '[]', -- array of {timestamp, views}
  cpm_rate numeric,
  created_at timestamptz not null default now()
);
