// generate-avatars.mjs
// Generates a library of REALISTIC, original AI avatar persona images on fal.ai.
// These are UGC-creator-style portraits you own outright (no licensing risk).
// Output: ./avatars/<slug>.png + avatars/manifest.json (feed this into your Supabase `avatars` table later)
//
// Usage:  npm run avatars
// Cost:   flux/dev is roughly $0.025/image -> full 10-persona library ≈ $0.25

import { fal } from "@fal-ai/client";
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

config();
fal.config({ credentials: process.env.FAL_KEY });

const IMAGE_MODEL = process.env.IMAGE_MODEL || "fal-ai/flux/dev";
const OUT_DIR = path.resolve("avatars");

// ---------------------------------------------------------------------------
// Persona definitions — the "cast" of your stock avatar library.
// The prompt style is deliberately UGC/selfie-realistic, NOT studio-glam:
// that's what converts in TikTok-style ads. Framing rules that matter for
// the lip-sync model: front-facing, eyes to camera, mouth CLOSED & neutral,
// head + upper chest visible, nothing covering the mouth.
// ---------------------------------------------------------------------------
const STYLE =
  "candid smartphone selfie style photo, front-facing, looking directly at camera, " +
  "neutral relaxed expression with mouth closed, head and shoulders framing, " +
  "soft natural window lighting, realistic skin texture with pores, shallow depth of field, " +
  "shot on iPhone, vertical portrait, photorealistic, no text, no watermark";

const PERSONAS = [
  { slug: "maya",   voiceHint: "warm conversational female, mid 20s",  prompt: `young woman in her mid 20s, shoulder-length dark wavy hair, light freckles, cozy beige sweater, sitting in a bright living room, ${STYLE}` },
  { slug: "jordan", voiceHint: "energetic male, late 20s",             prompt: `athletic man in his late 20s, short fade haircut, light stubble, charcoal t-shirt, home office with plants in background, ${STYLE}` },
  { slug: "elena",  voiceHint: "confident female, mid 30s",            prompt: `woman in her mid 30s, blonde hair in a loose bun, minimal makeup, white linen shirt, kitchen with warm morning light behind her, ${STYLE}` },
  { slug: "marcus", voiceHint: "deep friendly male, 40s",              prompt: `man in his early 40s, short natural hair, well-groomed beard, navy henley shirt, softly lit den with bookshelf, ${STYLE}` },
  { slug: "aisha",  voiceHint: "upbeat female, early 20s",             prompt: `young woman in her early 20s, curly dark hair, gold hoop earrings, mustard yellow top, dorm-style bedroom with fairy lights softly blurred, ${STYLE}` },
  { slug: "ryan",   voiceHint: "casual relatable male, mid 20s",       prompt: `man in his mid 20s, medium-length brown hair under a plain cap worn backwards, gray hoodie, car interior daylight setting, ${STYLE}` },
  { slug: "grace",  voiceHint: "calm reassuring female, 50s",          prompt: `woman in her mid 50s, silver-streaked bob haircut, tortoiseshell glasses, sage green cardigan, sunlit reading nook, ${STYLE}` },
  { slug: "diego",  voiceHint: "friendly male, 30s",                   prompt: `man in his early 30s, dark hair swept back, warm smile lines, olive overshirt, cafe window seat with soft bokeh, ${STYLE}` },
  { slug: "priya",  voiceHint: "polished professional female, 30s",    prompt: `woman in her early 30s, long straight black hair, small stud earrings, blush blouse, clean modern home office, ${STYLE}` },
  { slug: "tom",    voiceHint: "trustworthy male, 50s",                prompt: `man in his mid 50s, gray hair neatly combed, clean shaven, light blue oxford shirt, workshop garage softly blurred behind him, ${STYLE}` },
];

async function generateOne(persona) {
  console.log(`→ generating ${persona.slug} ...`);
  const result = await fal.subscribe(IMAGE_MODEL, {
    input: {
      prompt: persona.prompt,
      image_size: "portrait_16_9", // if your model rejects this, use { width: 768, height: 1344 }
      num_images: 1,
    },
    logs: false,
  });

  const imageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL returned for ${persona.slug}: ${JSON.stringify(result).slice(0, 300)}`);

  const res = await fetch(imageUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT_DIR, `${persona.slug}.png`);
  await writeFile(file, buf);
  console.log(`  ✓ saved ${file}`);
  return { ...persona, image_url: imageUrl, local_file: file };
}

async function main() {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY missing — copy .env.example to .env and fill it in.");
  await mkdir(OUT_DIR, { recursive: true });

  const manifest = [];
  for (const p of PERSONAS) {
    try {
      manifest.push(await generateOne(p));
    } catch (err) {
      console.error(`  ✗ ${p.slug} failed:`, err.message);
    }
  }

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.length}/${PERSONAS.length} avatars in ./avatars + manifest.json`);
  console.log("Review each image — regenerate any with odd hands/teeth by re-running (results vary per seed).");
}

main().catch((e) => { console.error(e); process.exit(1); });
