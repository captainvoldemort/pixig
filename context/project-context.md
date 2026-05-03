# Pixig.ai — Project Context

> **This file is the single source of truth for architecture, schema, and design
> decisions. Update it any time you change the schema, the AI pipeline, or any
> major integration.**

Last updated: 2026-05-03 (v2 — text-only pipeline)

---

## 1. What Pixig is

Pixig.ai is a SaaS for e-commerce sellers. A user uploads a product image and
description; Pixig returns:

1. A **diagnosis** of what's wrong with the current product visual + what's
   missing.
2. Three Instagram-ready creatives — **studio**, **lifestyle**, and **poster** —
   each with a rich image prompt, a hook, a caption, and the reasoning behind it.

Each generation is saved as a **version**. Old outputs are never deleted; new
generations are appended.

The current pipeline is **text-only** (see §6). Image generation is preserved in
code as a one-flag flip for when paid-tier billing is enabled.

---

## 2. Architecture overview

```
            ┌────────────────────────┐
            │      Browser (UI)      │
            │  Next.js App Router    │
            │   React + Tailwind     │
            └─────────┬──────────────┘
                      │  HTTPS, SSR + API routes
                      ▼
            ┌────────────────────────┐
            │   Next.js Server       │
            │  /api/upload           │
            │  /api/generate         │
            │  Server Components     │
            └─────────┬──────────────┘
                      │
       ┌──────────────┼──────────────────┐
       ▼              ▼                  ▼
 ┌───────────┐  ┌───────────┐    ┌────────────────────┐
 │ Supabase  │  │ Cloudinary│    │  Google Gemini     │
 │ Auth + DB │  │ Image CDN │    │  gemini-2.5-flash  │
 │  + RLS    │  │ (sources) │    │  (vision + plan)   │
 └───────────┘  └───────────┘    └────────────────────┘
```

- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
  Deployed on Vercel.
- **Backend**: Next.js API routes (Node.js runtime). Supabase Postgres holds
  all user/project data behind RLS.
- **Auth**: Supabase Auth (email + password). `@supabase/ssr` propagates the
  session cookie across server components and route handlers via
  `src/middleware.ts`.
- **AI**: Google Gemini.
  - **`gemini-2.5-flash`** is the *only* model called in the live pipeline.
    It's multimodal — input includes the user's product image (`inlineData`,
    base64) and the description; output is a JSON plan with diagnosis + three
    creative briefs.
  - `imagen-4.0-fast-generate-001` is referenced in `src/lib/gemini.ts` but is
    *not called* in text-only mode (paid tier — see §6).
- **Image storage**: Cloudinary. Source product photos are uploaded
  server-side; images never bypass our backend.

---

## 3. Data flow

### Generate flow (`POST /api/generate`)

1. Client submits `{ projectId, productDescription, prompt, imageDataUrl }`.
2. Server resolves the source image:
   - If a fresh `imageDataUrl` was sent: parse → upload to Cloudinary → store
     the URL on the project.
   - Else if the project already has `image_url`: fetch it back as base64 so
     we can pass it to Gemini as `inlineData`.
3. **Plan call** (`gemini-2.5-flash`):
   - `responseMimeType: 'application/json'` for reliable parsing.
   - `temperature: 0.7` so vision-extracted product facts (color, label,
     materials) stay faithful while creative copy still varies.
   - `maxOutputTokens: 8192` (room for three rich 110–150-word prompts).
   - `thinkingConfig.thinkingBudget: 0` — structured-JSON tasks don't benefit
     from chain-of-thought, and "thinking" tokens were eating the output
     budget and causing truncation.
   - Returns `{ diagnosis, outputs: [{ type, image_prompt, hook, caption, reasoning }] }`.
4. **Image generation step is currently skipped** (TEXT_ONLY = true). For each
   output, we set `image_url = ''` and persist `image_prompt` for the UI to
   render.
5. Persist:
   - 1 row in `versions` (with `diagnosis`, `prompt`).
   - 1 row in `outputs` per creative type (linked to that version).
6. Return the new `VersionWithOutputs` to the client; it's appended to the
   in-memory list and the new tab is auto-selected.

### Upload flow (`POST /api/upload`)

Used when the user uploads a product image *before* generating, so the
Cloudinary URL is persisted on the project immediately. Server expects
`imageDataUrl` (a `data:image/...;base64,...` URL), splits the prefix, uploads
to Cloudinary, and updates `projects.image_url`.

### Image handling — explicit cases

| Source | What we do |
| --- | --- |
| User upload (`data:image/...;base64,...`) | Decode → upload to Cloudinary → store `secure_url` on the project. |
| Generated images (Gemini → base64) | **Currently disabled.** When re-enabled: decode → upload to Cloudinary → store URL in `outputs.image_url`. Raw bytes are never persisted to Postgres. |

We **never** store raw binary in Postgres. All image fields in the DB are URLs
(or empty strings in text-only mode).

---

## 4. Database schema (current)

> Mirrored in [`supabase/schema.sql`](../supabase/schema.sql). Always update both
> this section and that file in lockstep when the schema changes.

### `auth.users` (Supabase-managed)
- `id` (uuid)
- `email`

We don't own/extend the users table. Everything user-scoped joins on `auth.uid()`.

### `public.projects`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid (pk) | `gen_random_uuid()` |
| `user_id` | uuid (fk) | → `auth.users(id)`, cascade delete |
| `name` | text | required |
| `product_description` | text | default `''` |
| `image_url` | text | nullable; Cloudinary URL of the source product photo |
| `created_at` | timestamptz | default `now()` |

Index: `(user_id, created_at desc)`.

### `public.versions`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid (pk) | |
| `project_id` | uuid (fk) | → `projects(id)`, cascade |
| `created_at` | timestamptz | default `now()` |
| `diagnosis` | jsonb | `{ whats_wrong: string[], whats_missing: string[], summary: string }` |
| `prompt` | text | nullable; user's extra direction for this run |

Index: `(project_id, created_at)`.

### `public.outputs`

Custom enum: `output_type = 'studio' | 'lifestyle' | 'poster'`.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid (pk) | |
| `version_id` | uuid (fk) | → `versions(id)`, cascade |
| `type` | output_type | one of studio / lifestyle / poster |
| `image_url` | text not null default `''` | Cloudinary URL OR `''` in text-only mode |
| `image_prompt` | text not null default `''` | Rich prompt the user can paste into any image-gen tool |
| `hook` | text | |
| `caption` | text | |
| `reasoning` | text | "why this works" |

Index: `(version_id)`.

### Row-level security
Every table has RLS enabled with policies that scope all access through the
owning `projects.user_id`. See `supabase/schema.sql` for the exact policies.

### Migrations

- [`supabase/schema.sql`](../supabase/schema.sql) — full install for fresh
  Supabase projects.
- [`supabase/migration-text-only.sql`](../supabase/migration-text-only.sql) —
  for older installs that pre-date the text-only pipeline. Idempotent: only
  *adds* the `image_prompt` column; doesn't modify any existing column or row.

---

## 5. API integrations

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by both
  the browser client (via `createBrowserClient`) and the server client (via
  `createServerClient`).
- `SUPABASE_SERVICE_ROLE_KEY` — reserved for server-side admin tasks; **never**
  exposed to the browser. Currently unused (RLS + the user's session is
  enough) but available via `createServiceClient()` in `src/lib/supabase/server.ts`.
- The codebase reads the **legacy JWT** `anon` and `service_role` keys.
  Supabase's newer `sb_publishable_…` / `sb_secret_…` keys also work, but the
  legacy names match the env-var conventions used here. Don't disable JWT keys
  on the Supabase project.

### Gemini (Google AI Studio)

- Single env var: `GEMINI_API_KEY`.
- Model hard-coded in `src/lib/gemini.ts`:
  - `TEXT_MODEL = 'gemini-2.5-flash'` — the live model. Multimodal in, JSON out.
  - `IMAGE_MODEL = 'imagen-4.0-fast-generate-001'` — referenced for future
    paid-tier image gen. Not called in text-only mode.
- The plan call uses:
  - `responseMimeType: 'application/json'`
  - `temperature: 0.7`
  - `maxOutputTokens: 8192`
  - `thinkingConfig.thinkingBudget: 0`
- Vision input is sent as `inlineData: { mimeType, data }` where `data` is
  base64. The same product image is referenced for diagnosis grounding and for
  the `image_prompt` extraction step.

### Cloudinary

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  `CLOUDINARY_UPLOAD_FOLDER` (default `pixig`).
- Folder layout:
  - `pixig/users/<user_id>/uploads/...` — source product photos
  - `pixig/users/<user_id>/projects/<project_id>/outputs/...` — generated
    images (currently unused — kept for the paid-tier flip)
- Server-side `cloudinary.uploader.upload(dataUri, { folder })`. The browser
  never receives Cloudinary credentials.

---

## 6. Design decisions (and why)

- **Single Generate button (left panel)**: matches the Leonardo.ai workflow.
  Per the spec, regenerate is *not* placed inside individual cards — that
  would invite users to mutate one creative at a time, which breaks the
  "version = full set of three" contract.
- **Versions are immutable**: every Generate appends a new `versions` row with
  a fresh set of `outputs`. Old runs are preserved so users can A/B them.
- **Vision + planning in one call**: rather than a vision-then-text pipeline,
  we send the image and description to `gemini-2.5-flash` once and ask it to
  internally extract product visual facts, diagnose the photo, and write three
  rich image prompts (with the product description embedded so a downstream
  text-to-image model could reproduce it). Halves latency and cost.
- **Text-only on free tier**: every Gemini/Imagen image-gen model is paid-only
  per [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing).
  We provide a "copy this prompt" card instead of failing the request. The
  `generateImage` helper and `IMAGE_MODEL` constant are kept so a billing flip
  is one boolean change in `route.ts`.
- **Thinking disabled on the plan call**: Gemini 2.5 Flash includes internal
  chain-of-thought by default; those thinking tokens count against
  `maxOutputTokens` and were truncating the JSON. Disabled via
  `thinkingConfig.thinkingBudget: 0`.
- **Server-only AI**: Gemini and Cloudinary keys never reach the browser. All
  AI work happens in `/api/generate`, which runs on Node.js (`runtime: 'nodejs'`,
  `maxDuration: 300`).
- **No Supabase Storage**: we explicitly chose Cloudinary over Supabase
  Storage for image hosting — better transformations, generous free tier, and
  we keep Supabase scoped to "auth + relational data".
- **Tailwind dark theme + glass UI**: matches the Leonardo aesthetic the spec
  calls out and reads well on Instagram-style preview cards.
- **Native `<img>` over `next/image`**: keeps Cloudinary URLs simple. ESLint
  rule disabled in `.eslintrc.json`.

---

## 7. Project structure

```
pixig/
├── README.md                        # setup + deployment guide
├── context/
│   └── project-context.md           # ← you are here
├── supabase/
│   ├── schema.sql                   # full DB + RLS schema
│   └── migration-text-only.sql      # adds image_prompt column to existing DBs
├── src/
│   ├── middleware.ts                # session refresh + route guard
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
│   │   └── InstagramCard.tsx        # IG-style image OR prompt-preview
│   └── lib/
│       ├── types.ts
│       ├── utils.ts
│       ├── gemini.ts                # generatePlan + (preserved) generateImage
│       ├── cloudinary.ts
│       └── supabase/
│           ├── client.ts
│           ├── server.ts
│           └── middleware.ts
```

---

## 8. Known limitations

- **Free tier blocks image generation**: every Gemini/Imagen image model is
  paid-only. Pixig ships rich prompts users can paste into AI Studio /
  Midjourney / ChatGPT instead. Flipping back on requires billing — see
  [README §5](../README.md#5-why-text-only-and-how-to-flip-back-to-image-gen).
- **Cold-start latency**: the plan call typically returns in 5–15s on Vercel
  Hobby. With image gen enabled, full generation is 30–90s and may exceed the
  60s Hobby function cap.
- **No regenerate-one-card flow**: by design (see decisions). A future
  improvement could be "duplicate version, swap one output" — but the spec
  explicitly requires regenerate to live in the left panel only.
- **No team / org model**: each project is owned by exactly one user.
- **No download-as-zip / export**: download is per-image (open Cloudinary URL).
- **No image editing post-generation**: outputs are write-once per version.
- **Email confirmation flow**: signup either logs the user in immediately (if
  email confirmation is disabled in Supabase) or shows a "check your inbox"
  message. We don't currently host a custom confirmation page.
- **Caption / hashtag length is governed by the prompt, not enforced**.
