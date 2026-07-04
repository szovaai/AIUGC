# AI Video SaaS — Full Architecture & Build Plan
### Working codename: **VidForge** (rename at will)
**Owner:** Jason | **Date:** July 2026 | **Goal:** Standalone SaaS — Creatify/HeyGen-class capability, bootstrap budget, solo builder

---

## 1. Positioning: Don't clone HeyGen. Undercut it at the wedge.

HeyGen and Creatify are venture-funded, enterprise-focused, and priced for teams. You cannot out-feature them. You CAN out-niche and out-price them, because the core rendering tech they use is now commoditized — HeyGen's own models (Avatar IV, Video Agent) and Creatify's Aurora avatar model are literally available as pay-per-use APIs on fal.ai. The moat is no longer the model. The moat is workflow + niche + distribution.

**Your unfair advantages:**
- 200+ WarriorPlus affiliates = instant launch distribution (nobody building a HeyGen clone has this)
- LoveLife Treasures = live dogfooding environment (every feature gets validated on a real store)
- Sycado pipeline experience = you already know the agent-orchestration pattern
- Existing fal.ai account/workflows from the LoveLife image pipeline

**The wedge (v1 positioning):**
> "UGC video ads for solo ecom sellers — from product URL to 5 ready-to-post TikTok ads in 10 minutes, for 1/10th of Creatify's price."

Target customer: Shopify/Etsy solo sellers and dropshippers doing <$10k/mo who can't afford Creatify ($39–$99+/mo) or a UGC creator ($60–150/video). This is also exactly the WarriorPlus buyer demographic.

**What v1 is NOT:** avatar cloning, video translation, enterprise SSO, team seats, API access. Cut ruthlessly.

---

## 2. Core Feature Set

### MVP (Phase 1–2, ship in ~4–6 weeks)
1. **Script Studio** — Paste product URL or description → LLM generates 3–5 UGC-style ad scripts (hook / body / CTA structure, 15–30s)
2. **Avatar Library** — 20–40 stock "creator" avatars (AI-generated persona images via fal.ai image models — you own them outright, zero licensing risk)
3. **Voice Selection** — ElevenLabs voices mapped to each avatar persona
4. **Render Pipeline** — Script → TTS audio → avatar lip-sync video (fal.ai) → optional caption burn-in → MP4 download
5. **Credits + Billing** — Stripe subscription tiers, credit-metered rendering
6. **Project Dashboard** — Video history, status tracking, re-render

### v1.1 (Phase 3)
7. **URL-to-Ad** — Scrape product page → auto-extract name/benefits/price/images → full ad generation without typing
8. **B-roll splicer** — Interleave avatar clips with product images (Ken Burns pan/zoom) via ffmpeg — this is what makes output look like a real UGC ad, not a talking head
9. **Batch mode** — 1 product → N script variants → N videos (ad testing angle)

### v2 (only after revenue)
10. Custom avatar from user photo (Avatar IV / OmniHuman on user-uploaded image — needs consent flow + moderation)
11. Auto-captions with styled templates (Whisper timestamps + ASS subtitle burn)
12. Direct publish to TikTok/Pinterest (TrafficPins integration — cross-sell your own tool)

---

## 3. Tech Stack (aligned to your existing tooling)

| Layer | Choice | Why |
|---|---|---|
| Frontend/App | **Next.js 14 (App Router)** | You already run this pattern in Sycado; deploy Netlify or Vercel |
| UI scaffolding | **Lovable** for v0 screens → export → refine in Claude Code | Your proven flow |
| Backend/DB/Auth | **Supabase** (Postgres, Auth, Storage, RLS) | Your default; RLS handles multi-tenant cleanly |
| Job queue | **Supabase table-as-queue + pg_cron + Edge Functions**, upgrade to **Inngest** (free tier) if reliability bites | Video renders take 1–5 min; must be async |
| LLM (scripts) | **OpenRouter** (Claude Sonnet / GPT class via lib/router.ts pattern from Sycado) | Reuse your registry pattern |
| TTS | **ElevenLabs API** (you have skills/workflows for this already) | Best voice quality; ~$0.10–0.30/min of audio |
| Avatar video | **fal.ai** — primary: Kling AI Avatar v2 Standard ($0.0562/s); premium tier: OmniHuman ($0.14/s) or HeyGen Avatar IV via fal | Pay-per-use, no minimums, webhook callbacks, one API key |
| Avatar images | **fal.ai** image models (Seedream/FLUX) — generate your stock avatar library once | You own the personas |
| Video assembly | **ffmpeg** in a worker (Railway/Fly.io micro instance, or fal workflow if sufficient) | Caption burn, b-roll splice, watermark on free tier |
| Payments | **Stripe** (Checkout + Billing + webhooks — same smoke-test discipline as Sycado) | Known quantity |
| URL scraping | **Firecrawl or plain fetch + LLM extraction** | For URL-to-Ad in Phase 3 |

**Monthly fixed cost at zero customers: ~$0–25.** Everything is usage-based. This is the whole point.

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js App (Netlify/Vercel)                               │
│  /dashboard  /studio  /library  /billing  /admin            │
└──────────────┬──────────────────────────────────────────────┘
               │ Supabase client (RLS-scoped)
┌──────────────▼──────────────────────────────────────────────┐
│  SUPABASE                                                   │
│  Auth │ Postgres │ Storage (renders/, avatars/, audio/)     │
│  Edge Functions:                                            │
│   • generate-script   (OpenRouter call, sync, ~5s)          │
│   • enqueue-render    (writes job row, returns job_id)      │
│   • render-worker     (cron-triggered, processes queue)     │
│   • fal-webhook       (receives completed video URL)        │
│   • stripe-webhook    (credits top-up, sub lifecycle)       │
└──────┬───────────────┬───────────────┬──────────────────────┘
       │               │               │
┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼──────────┐
│ OpenRouter │  │ ElevenLabs │  │ fal.ai          │
│ (scripts)  │  │ (TTS mp3)  │  │ (avatar video,  │
│            │  │            │  │  webhook cb)    │
└────────────┘  └────────────┘  └─────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ ffmpeg worker      │
                              │ (captions, b-roll, │
                              │  watermark, final  │
                              │  mux → Storage)    │
                              └────────────────────┘
```

### Render pipeline state machine (the heart of the product)

```
DRAFT → SCRIPT_READY → TTS_PENDING → TTS_DONE →
RENDER_QUEUED → RENDERING (fal async) → RENDER_DONE →
POST_PENDING (ffmpeg) → COMPLETE
                ↘ any step → FAILED (with error_code, auto-refund credits)
```

Rules:
- Every state transition is a row update on `render_jobs` + an event row in `job_events` (audit trail, debuggability — same discipline as Sycado's honest-status rule)
- Credits are **debited at enqueue, refunded on FAILED**. Never charge for failures.
- fal.ai calls use **webhook mode**, not polling — Edge Function `fal-webhook` receives completion, verifies signature, advances state
- Idempotency keys on every external call (job_id + step) so retries never double-render/double-charge

---

## 5. Data Model (Supabase migrations)

```sql
-- users handled by Supabase Auth; profile extension:
profiles (id uuid pk → auth.users, display_name, plan text,
          credits int default 0, created_at)

avatars (id uuid pk, name, persona_desc, image_url,
         voice_id text,            -- ElevenLabs voice mapping
         tier text default 'standard',  -- standard | premium
         is_active bool)

projects (id uuid pk, user_id fk, name, product_url,
          product_data jsonb,      -- scraped/extracted product info
          created_at)

scripts (id uuid pk, project_id fk, variant_no int,
         hook text, body text, cta text, full_text text,
         duration_est_s int, model_used text, created_at)

render_jobs (id uuid pk, user_id fk, project_id fk, script_id fk,
             avatar_id fk, status text, credits_cost int,
             tts_audio_url text, raw_video_url text,
             final_video_url text, error_code text,
             fal_request_id text, idempotency_key text unique,
             created_at, updated_at)

job_events (id bigserial pk, job_id fk, from_status, to_status,
            payload jsonb, created_at)

credit_ledger (id bigserial pk, user_id fk, delta int,
               reason text,        -- purchase | render | refund | bonus
               job_id fk null, stripe_ref text null, created_at)
```

RLS: every table scoped `user_id = auth.uid()` except `avatars` (public read). `credit_ledger` is append-only; balance = SUM(delta), cached on `profiles.credits` via trigger.

---

## 6. Unit Economics & Pricing (the part that makes this viable)

### Cost per 30-second video (your COGS)

| Component | Cost |
|---|---|
| Script generation (LLM via OpenRouter) | ~$0.01–0.03 |
| TTS 30s (ElevenLabs) | ~$0.05–0.15 |
| Avatar render — Kling v2 Standard @ $0.0562/s × 30s | **$1.69** |
| Avatar render — premium (OmniHuman @ $0.14/s × 30s) | $4.20 |
| ffmpeg post + storage/bandwidth | ~$0.02 |
| **Total (standard tier)** | **~$1.80–1.90** |
| **Total (premium tier)** | **~$4.40** |

### Credit system
- 1 credit = 1 second of rendered video (simple, legible)
- Standard render: 1 credit/s. Premium render: 2.5 credits/s.
- Your cost per credit ≈ $0.06. Sell credits at $0.15–0.25 → **60–75% gross margin**.

### Pricing tiers (undercut Creatify's $39 entry hard)

| Plan | Price | Credits/mo | ≈ Standard videos (30s) | Notes |
|---|---|---|---|---|
| Free | $0 | 60 | 2 | Watermarked, standard avatars only |
| Starter | **$19/mo** | 450 | 15 | No watermark |
| Growth | **$49/mo** | 1,500 | 50 | Premium avatars, batch mode |
| Scale | **$99/mo** | 3,600 | 120 | URL-to-Ad priority queue, early API |
| Credit packs | $10–50 | à la carte | — | Top-ups, never expire |

Gross margin check at Starter: revenue $19, worst-case COGS if fully consumed ≈ $8.50 → ~55% margin floor. Typical utilization is 40–60%, so real margin lands 70%+.

### Break-even reality check (your constraint: ~$2k/mo income)
- Fixed costs ≈ $25/mo (domain, misc). 
- **2 Starter customers = infrastructure paid for. 30 Starter customers = $570 MRR. 100 = $1,900 MRR ≈ doubles your income.**
- A single WarriorPlus launch to your 200+ affiliate list historically converts — even 50 trials → 15 paid is a realistic first-week outcome.

---

## 7. API Routes (Next.js App Router)

```
POST /api/projects                    create project (name, url?)
POST /api/projects/:id/extract       scrape URL → product_data (Phase 3)
POST /api/projects/:id/scripts       generate N script variants
POST /api/renders                    enqueue render {script_id, avatar_id, tier}
GET  /api/renders/:id                job status (polled by UI every 3s)
POST /api/webhooks/fal               fal completion callback (verify sig)
POST /api/webhooks/stripe            billing lifecycle
GET  /api/avatars                    public avatar library
GET  /api/me/credits                 balance + ledger
```

UI status polling is fine for MVP (renders take 1–5 min); upgrade to Supabase Realtime subscription on `render_jobs` when polish matters.

---

## 8. Build Phases

### Phase 0 — Foundation (2–3 days)
- [ ] Repo `szovaai/vidforge`, Next.js + Supabase scaffold, CLAUDE.md with the same **HONEST-STATUS / no-LIVE-without-smoke-test** rule as Sycado
- [ ] Migrations for full data model above
- [ ] fal.ai key + ElevenLabs key + OpenRouter key in env; one manual end-to-end test **by hand via curl**: script → TTS mp3 → Kling avatar render → mp4. Prove the pipeline works before writing any product code. **This is the day-3 gate.**

### Phase 1 — Render pipeline (week 1–2)
- [ ] Avatar library: generate 25 persona images on fal (diverse ages/styles matching UGC creator vibe), map each to an ElevenLabs voice, seed `avatars` table
- [ ] Edge Functions: generate-script, enqueue-render, render-worker, fal-webhook
- [ ] State machine + job_events + credit debit/refund logic
- [ ] Minimal UI: paste product description → pick avatar → render → download
- **Gate: 10 consecutive successful renders, zero manual intervention**

### Phase 2 — SaaS wrapper (week 3–4)
- [ ] Auth flows, dashboard, project history
- [ ] Stripe: 3 tiers + credit packs, webhook → credit_ledger
- [ ] Free-tier watermark (ffmpeg overlay), rate limits (max 3 concurrent jobs/user)
- [ ] Landing page (Lovable → refine): demo video above the fold — **use LoveLife Treasures products as the demo content**, killing two birds
- **Gate: your own Stripe smoke test discipline — live card test, webhook fires, credits land → "SMOKE TEST LIVE"**

### Phase 3 — The differentiator (week 5–6)
- [ ] URL-to-Ad: scrape → extract → auto-scripts → auto-render pipeline
- [ ] B-roll splicer: product images interleaved with avatar clips (ffmpeg concat + zoompan)
- [ ] Batch mode: 1 product → 5 variants
- **Launch: WarriorPlus affiliate campaign + founder's lifetime-credit deal**

### Phase 4 — Post-revenue only
- Custom photo avatars (consent checkbox + face-detection moderation gate — do NOT skip moderation; this is the #1 abuse vector for these products)
- Auto-captions, TikTok direct publish, TrafficPins cross-integration
- Affiliate program inside the product (your WarriorPlus DNA)

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| fal model deprecation/price change | Provider-adapter layer (`lib/render-providers.ts`, mirror your model-registry pattern) — Kling, OmniHuman, HeyGen-via-fal all behind one interface; swap = config change |
| Abuse (deepfakes via custom avatars) | v1 ships stock avatars ONLY. Custom uploads gated behind Phase 4 with consent attestation + moderation API |
| Renders fail mid-pipeline | Auto-refund + retry-once policy; job_events makes every failure debuggable |
| Margin squeeze if users pick premium | Credit multiplier (2.5×) keeps premium margin-neutral |
| ADHD scope creep (known pattern) | Phase gates are binary. No Phase 2 code until Phase 1 gate passes. Print section 8, tape it to the wall. |
| HeyGen/Creatify drop prices | Your floor is lower (no payroll, no SF office). Compete on niche workflow (ecom UGC ads), not feature count |

## 10. Definition of "LIVE" (Sycado rule, inherited)
No capability is claimed LIVE on the marketing site until it has passed a live smoke test end-to-end with real money / real render. HONEST-STATUS.md from day one.

---

**First action:** Phase 0, day-3 gate — one manual curl-driven render proving script → ElevenLabs → fal Kling avatar → mp4. Everything else is negotiable; that isn't.
