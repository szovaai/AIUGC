// render.mjs — THE PHASE 0 GATE
// Full pipeline: ad script (text) -> ElevenLabs TTS (mp3) -> fal.ai avatar lip-sync -> final .mp4
//
// Usage:
//   npm run render -- --image ./avatars/maya.png --text "Okay I have to show you this..."
//   npm run render -- --image ./avatars/maya.png --script ./script.txt --voice 21m00Tcm4TlvDq8ikWAM
//
// Cost per run (30s of audio): TTS ~$0.10 + Kling v2 Standard ~$1.69 ≈ $1.80
// Passing this once, by hand, is the day-3 gate. Ten clean runs = Phase 1 gate.

import { fal } from "@fal-ai/client";
import { config } from "dotenv";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

config();
fal.config({ credentials: process.env.FAL_KEY });

const AVATAR_MODEL = process.env.AVATAR_MODEL || "fal-ai/kling-video/ai-avatar/v2/standard";
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const OUT_DIR = path.resolve("renders");

// ---------- tiny arg parser ----------
function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// ---------- step 1: TTS via ElevenLabs ----------
async function textToSpeech(text, voiceId) {
  console.log(`[1/4] ElevenLabs TTS (voice ${voiceId}) ...`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  const mp3 = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT_DIR, `tts-${Date.now()}.mp3`);
  await writeFile(file, mp3);
  console.log(`      ✓ audio saved ${file} (${(mp3.length / 1024).toFixed(0)} KB)`);
  return { mp3, file };
}

// ---------- step 2: upload assets to fal storage ----------
async function uploadToFal(buffer, filename, mime) {
  const fileObj = new File([buffer], filename, { type: mime });
  const url = await fal.storage.upload(fileObj);
  return url;
}

// ---------- step 3: avatar lip-sync render ----------
async function renderAvatar(imageUrl, audioUrl) {
  console.log(`[3/4] Rendering avatar via ${AVATAR_MODEL} (this takes 1–5 min) ...`);
  const result = await fal.subscribe(AVATAR_MODEL, {
    input: {
      image_url: imageUrl,
      audio_url: audioUrl,
      // Optional nudge for motion style — supported by Kling avatar; ignored by models that don't use it:
      prompt: "person talking naturally to camera, subtle head movement, engaged friendly expression",
    },
    logs: true,
    onQueueUpdate: (u) => {
      if (u.status === "IN_PROGRESS") {
        (u.logs || []).slice(-1).forEach((l) => console.log(`      fal: ${l.message}`));
      } else {
        console.log(`      queue: ${u.status}`);
      }
    },
  });

  const videoUrl = result?.data?.video?.url ?? result?.video?.url;
  if (!videoUrl) throw new Error(`No video URL in fal response: ${JSON.stringify(result).slice(0, 400)}`);
  return videoUrl;
}

// ---------- main ----------
async function main() {
  for (const k of ["FAL_KEY", "ELEVENLABS_API_KEY"]) {
    if (!process.env[k]) throw new Error(`${k} missing — copy .env.example to .env and fill it in.`);
  }

  const imagePath = arg("image");
  if (!imagePath) throw new Error("Provide --image ./avatars/<name>.png");

  const voiceId = arg("voice", process.env.ELEVENLABS_VOICE_ID);
  const scriptPath = arg("script");
  const text =
    arg("text") ??
    (scriptPath ? (await readFile(scriptPath, "utf8")).trim() : null) ??
    // Default 15s smoke-test script (generic UGC hook — replace with a LoveLife product for the real demo)
    "Okay, stop scrolling for one second. I found the most thoughtful personalized gift, and honestly? The reaction when she opened it was priceless. Link is right below.";

  console.log(`Script (${text.split(/\s+/).length} words):\n  "${text}"\n`);
  await mkdir(OUT_DIR, { recursive: true });

  // 1) TTS
  const { mp3 } = await textToSpeech(text, voiceId);

  // 2) Upload image + audio to fal storage
  console.log("[2/4] Uploading assets to fal storage ...");
  const imgBuf = await readFile(imagePath);
  const [imageUrl, audioUrl] = await Promise.all([
    uploadToFal(imgBuf, path.basename(imagePath), "image/png"),
    uploadToFal(mp3, "voiceover.mp3", "audio/mpeg"),
  ]);
  console.log("      ✓ uploaded");

  // 3) Render
  const videoUrl = await renderAvatar(imageUrl, audioUrl);

  // 4) Download final mp4
  console.log("[4/4] Downloading final video ...");
  const vid = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
  const outFile = path.join(OUT_DIR, `render-${Date.now()}.mp4`);
  await writeFile(outFile, vid);

  console.log(`\n✅ PIPELINE COMPLETE`);
  console.log(`   video: ${outFile}`);
  console.log(`   remote: ${videoUrl}`);
  console.log(`\nIf the lips sync and it looks like a real person talking — the Phase 0 gate is PASSED.`);
}

main().catch((e) => { console.error("\n✗ FAILED:", e.message); process.exit(1); });
