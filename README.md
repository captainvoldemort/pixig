# Pixig.ai

> **Turn boring product images into high-converting Instagram creatives.**
> Drop a product photo + description. Pixig diagnoses what's holding your
> visual back, then ships three Instagram-ready creatives — studio, lifestyle,
> and poster — each with a hook, caption, and the reasoning behind it.
> Every generation is versioned; nothing is ever lost.

A SaaS scaffold built with Next.js 14, Supabase, Google Gemini, and Cloudinary.

---

## Table of contents

1. [What you get out of the box](#1-what-you-get-out-of-the-box)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [How a generation actually works](#4-how-a-generation-actually-works)
5. [Why text-only (and how to flip back to image gen)](#5-why-text-only-and-how-to-flip-back-to-image-gen)
6. [Project structure](#6-project-structure)
7. [Setup](#7-setup)
8. [Deploy to Vercel](#8-deploy-to-vercel)
9. [Using Pixig](#9-using-pixig)
10. [Commands](#10-commands)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What you get out of the box

- **Landing page** with hero, demo previews, feature sections.
- **Email/password auth** via Supabase.
- **Dashboard** listing your projects, with create-project modal.
- **Project workspace** in a Leonardo.ai-style layout: input panel on the left, Instagram-style output cards in the center, version tabs at the top.
- **Vision-aware planning**: a single Gemini call analyzes your product photo and returns a diagnosis + three creative briefs (rich image prompt, hook, caption, reasoning) as structured JSON.
- **Versioning**: every Generate appends a new version; old versions are immutable and switchable from the tab bar.
- **Cloudinary-backed image storage** for the source product photo.
- **Row-Level Security** on every table — users only see their own data.

---

## 2. Tech stack

| Layer | Tool | Notes |
| --- | --- | --- |
| Framework | **Next.js 14 (App Router)** | TypeScript, React 18 |
| Styling | **Tailwind CSS** | Custom dark theme |
| Auth + DB | **Supabase** | Postgres, Email auth, RLS |
| AI (vision + text) | **Google Gemini 2.5 Flash** | `gemini-2.5-flash` — multimodal in, JSON out |
| Image CDN | **Cloudinary** | Source product images |
| Hosting | **Vercel** | Node.js runtime for `/api/generate` |

### Models used

- **`gemini-2.5-flash`** — the *only* AI model in the live pipeline. Multimodal: takes the user's product image (as `inlineData` base64) plus the description, and returns a diagnosis + three creative briefs as JSON. Used for both **vision understanding** and **creative planning** in a single call.
- **`imagen-4.0-fast-generate-001`** — referenced in [src/lib/gemini.ts](src/lib/gemini.ts) for future image generation, but **not called** in the current text-only pipeline (see [§5](#5-why-text-only-and-how-to-flip-back-to-image-gen)).

---

## 3. Architecture

```
┌──────────────────────────────────────┐
│ Browser (Next.js / React / Tailwind) │
│  • Landing, auth, dashboard          │
│  • Project workspace + IG cards      │
└──────────────────┬───────────────────┘
                   │  HTTPS — SSR + cookies
                   ▼
┌──────────────────────────────────────┐
│ Next.js Server (Vercel)              │
│  • Server components                 │
│  • /api/upload — POST data URL       │
│  • /api/generate — POST plan request │
└──┬──────────────┬──────────────┬─────┘
   │              │              │
   ▼              ▼              ▼
┌────────┐   ┌──────────┐   ┌──────────────────────┐
│Supabase│   │Cloudinary│   │ Google Gemini API    │
│ Auth+DB│   │ Image CDN│   │ gemini-2.5-flash     │
│ + RLS  │   └──────────┘   │ (vision + planning)  │
└────────┘                  └──────────────────────┘
```

### API integrations

- **Supabase** — `@supabase/ssr` propagates the session cookie across server components, route handlers, and middleware. Service-role key is available server-side via `createServiceClient()` but isn't currently needed (RLS + the user's session is enough).
- **Gemini** — `@google/genai` SDK. The plan call uses `responseMimeType: 'application/json'` for reliable parsing, `temperature: 0.7` to keep vision-extracted product facts faithful, `maxOutputTokens: 8192`, and `thinkingConfig.thinkingBudget = 0` (structured-JSON tasks don't benefit from chain-of-thought, and thinking tokens were eating the output budget).
- **Cloudinary** — server-side `cloudinary.uploader.upload` with secure URLs. The browser never gets API credentials. Folders: `pixig/users/<user_id>/uploads/...` for source product photos.

---

## 4. How a generation actually works

```
┌────────────────────────────┐
│ 1. User submits the form   │  description, optional direction,
│    via Generate button     │  optional product image (data URL)
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 2. /api/upload (only if    │  base64 → Cloudinary
│    a fresh image was sent) │  → projects.image_url
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 3. /api/generate           │
│    a. Resolve product img  │  data URL OR fetch existing
│       as base64            │     image from Cloudinary
│    b. Gemini 2.5 Flash:    │  one call → JSON:
│       vision + plan        │     { diagnosis,
│                            │       outputs[3]: {
│                            │         image_prompt, hook,
│                            │         caption, reasoning } }
│    c. Persist:             │  versions row + 3 outputs rows
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 4. UI appends new version  │  scrolls to top, switches the
│    tab; old versions kept  │  tab bar to the new generation
└────────────────────────────┘
```

### Database schema (current)

> Mirrored in [`supabase/schema.sql`](supabase/schema.sql).

**`projects`**

| column | type | notes |
| --- | --- | --- |
| `id` | uuid (pk) | `gen_random_uuid()` |
| `user_id` | uuid (fk) | → `auth.users(id)`, cascade delete |
| `name` | text | required |
| `product_description` | text | default `''` |
| `image_url` | text | nullable; Cloudinary URL of the source product photo |
| `created_at` | timestamptz | default `now()` |

**`versions`**

| column | type | notes |
| --- | --- | --- |
| `id` | uuid (pk) | |
| `project_id` | uuid (fk) | → `projects(id)`, cascade |
| `created_at` | timestamptz | default `now()` |
| `diagnosis` | jsonb | `{ whats_wrong[], whats_missing[], summary }` |
| `prompt` | text | nullable; user's extra direction |

**`outputs`** — one per creative type per version

| column | type | notes |
| --- | --- | --- |
| `id` | uuid (pk) | |
| `version_id` | uuid (fk) | → `versions(id)`, cascade |
| `type` | `output_type` enum | `studio` / `lifestyle` / `poster` |
| `image_url` | text not null default '' | empty string in text-only mode |
| `image_prompt` | text not null default '' | rich prompt for downstream image gen |
| `hook` | text | |
| `caption` | text | |
| `reasoning` | text | "why this works" |

**Row-Level Security** is enabled on every table; all access is scoped through the owning `projects.user_id`.

---

## 5. Why text-only (and how to flip back to image gen)

**Status**: Pixig currently runs a **text-only pipeline**. Every Gemini/Imagen image-generation model (Nano Banana, Imagen 4 Fast/Generate/Ultra, Gemini 3.1 Flash Image) is **paid-tier-only** per the [official Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). New API keys without billing get `0/0` daily quota for all of them.

**What text-only mode does**:
- Plan call still runs and produces a rich, vision-grounded `image_prompt` per creative.
- Each output card renders a gradient panel with the prompt + a **Copy prompt** button + an **AI Studio** shortcut.
- The user pastes the prompt into AI Studio (free image gen via the *web UI*, just not the API), Midjourney, ChatGPT, etc., and drops the resulting image back into Instagram themselves.
- All other features — diagnosis, hooks, captions, reasoning, versioning — are unchanged.

**Flipping back on (after enabling billing)**:

1. Enable billing on the GCP project tied to your Gemini key — [console.cloud.google.com/billing](https://console.cloud.google.com/billing).
2. In [src/app/api/generate/route.ts](src/app/api/generate/route.ts):
   - Set `TEXT_ONLY = false`.
   - Add `import { generateImage } from '@/lib/gemini'`.
   - Replace the simple `.map(...)` over `plan.outputs` with a `Promise.all(...)` that calls `generateImage` and `uploadBase64` for each output. (The original loop is preserved in git history.)
3. No DB migration needed — `image_url` is already plumbed through. The card UI auto-switches modes whenever it sees a non-empty `image_url`.

---

## 6. Project structure

```
pixig/
├── README.md                        # this file
├── context/
│   └── project-context.md           # architecture, decisions, schema (kept in sync)
├── supabase/
│   ├── schema.sql                   # tables + enums + indexes + RLS (full install)
│   └── migration-text-only.sql      # adds image_prompt column to existing DBs
├── public/                          # (none currently)
├── src/
│   ├── middleware.ts                # session refresh + auth-route guard
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                 # landing
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── dashboard/page.tsx       # project list + create modal
│   │   ├── project/[id]/page.tsx    # workspace
│   │   └── api/
│   │       ├── upload/route.ts      # POST: data URL → Cloudinary
│   │       └── generate/route.ts    # POST: Gemini plan + persist version
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Logo.tsx
│   │   ├── NewProjectButton.tsx
│   │   ├── ProjectWorkspace.tsx     # client wrapper for /project/[id]
│   │   ├── LeftPanel.tsx            # Leonardo-style inputs + Generate
│   │   ├── VersionTabs.tsx
│   │   ├── DiagnosisPanel.tsx
│   │   └── InstagramCard.tsx        # IG-style preview / prompt-preview card
│   └── lib/
│       ├── types.ts                 # Project, Version, Output, Diagnosis…
│       ├── utils.ts                 # cn, formatRelative, truncate
│       ├── gemini.ts                # generatePlan + (preserved) generateImage
│       ├── cloudinary.ts            # uploadBase64
│       └── supabase/
│           ├── client.ts            # browser client
│           ├── server.ts            # server + service-role clients
│           └── middleware.ts        # session refresh helper
├── .env.example                     # env-var template
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 7. Setup

### Prerequisites

- Node.js ≥ 18.17 (Next.js 14 requirement)
- A GitHub account
- Free accounts: [Supabase](https://supabase.com), [Cloudinary](https://cloudinary.com), [Google AI Studio](https://aistudio.google.com)

### 7.1 — Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → pick region, set DB password.
2. **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - **Legacy** `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Legacy** `service_role` key (Reveal) → `SUPABASE_SERVICE_ROLE_KEY`

   *(The new "publishable / secret" keys also work, but the codebase is wired to the legacy JWT-format names. Don't click "Disable JWT-based API keys".)*

3. **Authentication → Sign In / Up → Email**: for easier dev, set "Confirm email" to **off** (re-enable for production).
4. **SQL Editor → New query**: paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
5. Verify in **Table Editor**: `projects`, `versions`, `outputs` exist, each with `RLS policies` badge ≥ 1 in the toolbar.

### 7.2 — Gemini (Google AI Studio)

1. [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → **Create API key** → copy → set `GEMINI_API_KEY`.
2. The codebase uses `gemini-2.5-flash` (free tier — generous quota for text + vision).
3. Image generation is **not** used by default (paid-only). See [§5](#5-why-text-only-and-how-to-flip-back-to-image-gen).

### 7.3 — Cloudinary

1. [cloudinary.com/users/register_free](https://cloudinary.com/users/register_free) → sign up.
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret** (click the eye to reveal).
3. Set the matching `CLOUDINARY_*` env vars. Folder is auto-created on first upload.

### 7.4 — Local dev

```bash
git clone https://github.com/<you>/pixig.git
cd pixig
npm install
cp .env.example .env.local
# fill in every var
npm run dev
# open http://localhost:3000
```

---

## 8. Deploy to Vercel

1. Push the repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import your repo → defaults are fine (Next.js auto-detected).
3. **Environment Variables** — paste each one from your `.env.local` (use Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER`
   - `NEXT_PUBLIC_APP_URL` *(set to your real Vercel URL after first deploy)*
4. **Deploy**. Wait for the build.
5. Update `NEXT_PUBLIC_APP_URL` to the real URL Vercel gave you → **Redeploy**.
6. **Supabase → Authentication → URL Configuration**:
   - **Site URL** → your Vercel URL.
   - **Redirect URLs** → add `https://<your-vercel-url>/**`.

> **Vercel runtime caveat**: `/api/generate` declares `maxDuration = 300` (5 min). The Hobby/free plan caps at **60s**. The current text-only pipeline returns in ~5–15s, so you'll be well under. (If you flip image generation back on, generation can take 30–90s and you may need Pro.)

### Migration for an existing deploy

If you previously installed an older schema, run [`supabase/migration-text-only.sql`](supabase/migration-text-only.sql) in Supabase SQL Editor. It only **adds** the `image_prompt` column — no existing rows or columns are altered.

```sql
alter table public.outputs
  add column if not exists image_prompt text not null default '';
```

---

## 9. Using Pixig

1. Sign up → log in.
2. Dashboard → **New project** → name + product description → Create.
3. In the project workspace:
   - **Upload a product photo** (left panel). Optional but strongly recommended — the diagnosis and prompts get much sharper when Gemini can see the actual product.
   - Edit the description and optional **Direction** (e.g. *"moody, cinematic, target Gen-Z runners"*).
   - Click **Generate**.
4. After ~5–15s, the center panel shows:
   - **Diagnosis** (what's wrong with the current photo + what's missing).
   - **Three Instagram cards** — studio, lifestyle, poster. Each has the rich `image_prompt`, hook, caption, and a "Why it works" toggle for the reasoning.
5. **Copy prompt** → paste into AI Studio / Midjourney / ChatGPT to render an actual image; **Copy caption** for IG.
6. Hit **Generate** again any time. A new version tab `v2`, `v3`, … appears at the top; previous versions are preserved.

---

## 10. Commands

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the build
npm run lint         # next lint
npm run type-check   # tsc --noEmit
```

---

## 11. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Login redirects in a loop | `NEXT_PUBLIC_APP_URL` doesn't match Supabase **Site URL**. |
| Auth works locally but not on Vercel | Add the Vercel URL to Supabase **Redirect URLs** (`https://<host>/**`). |
| `/api/generate` returns 401 | Cookie not set — confirm `NEXT_PUBLIC_APP_URL` matches the actual host. |
| `Gemini returned non-JSON plan (response was truncated…)` | Output exceeded `maxOutputTokens`. Either trim the description or raise the cap in `gemini.ts`. |
| `Imagen 3 is only available on paid plans` | You enabled image gen without billing on the GCP project — see [§5](#5-why-text-only-and-how-to-flip-back-to-image-gen). |
| Cloudinary upload fails | Verify all three `CLOUDINARY_*` vars (no quotes, no whitespace). |
| Vercel function timeout (504) | You're on Hobby + image gen enabled. Upgrade to Pro or stay on text-only. |
| RLS errors in Supabase logs | Re-run [`supabase/schema.sql`](supabase/schema.sql) — RLS policies didn't apply. |

Function logs: **Vercel dashboard → Deployments → [latest] → Functions → `/api/generate`**.

---

## License

Proprietary — all rights reserved.
