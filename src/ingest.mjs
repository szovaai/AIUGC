// ingest.mjs — SNIPPT PHASE 1: Ingest + Transcribe
// Long-form video -> audio extract (ffmpeg) -> ElevenLabs Scribe -> timestamped transcript
//
// Usage:
//   npm run ingest -- --file ./podcast.mp4
//   npm run ingest -- --url "https://www.youtube.com/watch?v=..."   (requires yt-dlp on PATH)
//   npm run ingest -- --file ./stream.mp4 --name my-episode
//
// Output: ./transcripts/<name>-<timestamp>.json
//   { source, language_code, text, words: [{ text, start, end }] }
// The words array is the word_timestamps jsonb for the Supabase `transcripts` table
// (see migrations/001_snippt_mvp.sql) — Phase 3 cutting/captioning consumes it directly.
//
// Phase 1 gate: one 20–30 min video in, >95% readable transcript out,
// Jason spot-checks 3 sections by hand.

import { config } from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

config();
const run = promisify(execFile);

const MEDIA_DIR = path.resolve("media");
const OUT_DIR = path.resolve("transcripts");
const SCRIBE_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

// ---------- tiny arg parser (same as render.mjs) ----------
function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// ---------- ffmpeg resolution: system binary if present, else the npm-bundled one ----------
async function ffmpegPath() {
  try {
    await run("ffmpeg", ["-version"]);
    return "ffmpeg";
  } catch {
    const { default: installer } = await import("@ffmpeg-installer/ffmpeg");
    return installer.path;
  }
}

// ---------- step 0 (optional): download source video via yt-dlp ----------
async function downloadVideo(url, stamp) {
  console.log(`[0/3] Downloading source via yt-dlp ...`);
  try {
    await run("yt-dlp", ["--version"]);
  } catch {
    throw new Error("yt-dlp not found on PATH. Install it (pipx install yt-dlp) or download the video manually and use --file.");
  }
  const outTpl = path.join(MEDIA_DIR, `source-${stamp}.%(ext)s`);
  await run("yt-dlp", ["-f", "b", "-o", outTpl, url], { maxBuffer: 64 * 1024 * 1024 });
  const match = (await readdir(MEDIA_DIR)).find((f) => f.startsWith(`source-${stamp}.`));
  if (!match) throw new Error("yt-dlp finished but no output file found in ./media");
  const file = path.join(MEDIA_DIR, match);
  console.log(`      ✓ downloaded ${file}`);
  return file;
}

// ---------- step 1: extract mono 16kHz mp3 (small upload, plenty for STT) ----------
async function extractAudio(videoPath, stamp) {
  console.log(`[1/3] Extracting audio with ffmpeg ...`);
  const ffmpeg = await ffmpegPath();
  const audioFile = path.join(MEDIA_DIR, `audio-${stamp}.mp3`);
  const { stderr } = await run(
    ffmpeg,
    ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audioFile],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
  const durationSeconds = durMatch
    ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3])
    : null;
  console.log(`      ✓ audio saved ${audioFile}${durationSeconds ? ` (${(durationSeconds / 60).toFixed(1)} min)` : ""}`);
  return { audioFile, durationSeconds };
}

// ---------- step 2: transcribe via ElevenLabs Scribe (word-level timestamps) ----------
async function transcribe(audioFile) {
  console.log(`[2/3] Transcribing via ElevenLabs Scribe (${SCRIBE_MODEL}) — a 30 min file takes a few minutes ...`);
  const buf = await readFile(audioFile);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), path.basename(audioFile));
  form.append("model_id", SCRIBE_MODEL);
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    const hint = res.status === 401 || res.status === 403
      ? "\n      Hint: the API key needs the 'Speech to Text' permission — check the key's scopes at elevenlabs.io."
      : "";
    throw new Error(`ElevenLabs Scribe ${res.status}: ${body}${hint}`);
  }
  return res.json();
}

// ---------- main ----------
async function main() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY missing — copy .env.example to .env and fill it in.");
  }

  const url = arg("url");
  const file = arg("file");
  if (!url && !file) throw new Error('Provide --file ./video.mp4 or --url "https://..."');

  await mkdir(MEDIA_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const stamp = Date.now();
  const videoPath = file ? path.resolve(file) : await downloadVideo(url, stamp);
  const name = arg("name", path.basename(videoPath, path.extname(videoPath)).replace(/[^a-z0-9-_]/gi, "-"));

  const { audioFile, durationSeconds } = await extractAudio(videoPath, stamp);
  const result = await transcribe(audioFile);

  const words = (result.words || [])
    .filter((w) => w.type === "word")
    .map((w) => ({ text: w.text, start: w.start, end: w.end }));

  const transcript = {
    source: {
      type: url ? "url" : "upload",
      input: url || videoPath,
      duration_seconds: durationSeconds,
      stt_model: SCRIBE_MODEL,
    },
    language_code: result.language_code ?? null,
    text: result.text,
    words,
  };

  console.log(`[3/3] Saving transcript ...`);
  const outFile = path.join(OUT_DIR, `${name}-${stamp}.json`);
  await writeFile(outFile, JSON.stringify(transcript, null, 2));

  const preview = words.slice(0, 30).map((w) => w.text).join(" ");
  console.log(`\n✅ INGEST COMPLETE`);
  console.log(`   transcript: ${outFile}`);
  console.log(`   duration:   ${durationSeconds ? (durationSeconds / 60).toFixed(1) + " min" : "unknown"}`);
  console.log(`   words:      ${words.length} (word-level timestamps)`);
  console.log(`   preview:    "${preview}${words.length > 30 ? " ..." : ""}"`);
  console.log(`\nPhase 1 gate: open the JSON and spot-check 3 sections against the video.`);
  console.log(`>95% readable and timestamps line up → Phase 1 PASSED, Phase 2 (moment scoring) unlocks.`);
}

main().catch((e) => { console.error("\n✗ FAILED:", e.message); process.exit(1); });
