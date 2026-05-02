# Pixig.ai — Project Context

> **This file is the single source of truth for architecture, schema, and design
> decisions. Update it any time you change the schema, the AI pipeline, the
> data flow, or any major integration.**

Last updated: 2026-05-02 (v1 scaffold)

---

## 1. What Pixig is

Pixig.ai is a SaaS for e-commerce sellers. A user uploads a product image and
description; Pixig returns:

1. A **diagnosis** of what's wrong with the current product visual + what's
   missing.
2. Three Instagram-ready creatives — **studio**, **lifestyle**, and **poster** —
   each with an image, a hook, a caption, and the reasoning behind it.

Each generation is saved as a **version**. Old outputs are never deleted; new
generations are appended.

---

## 2. Architecture overview

```
            ┌────────────────────────┐
            │      Browser (UI)      │
            │  Next.js App Router    │
            │   React + Tailwind     │
            └─────────┬──────────────┘
                      │  (HTTPS, SSR + API routes)
                      ▼
            ┌────────────────────────┐
            │   Next.js Server       │
            │  /api/upload           │
            │  /api/generate         │
            │  Server Components     │
            └─────────┬──────────────┘
                      │
       ┌──────────────┼─────────────────┐
       ▼              ▼                 ▼
 ┌───────────┐  ┌───────────┐    ┌──────────────┐
 │ Supabase  │  │ Cloudinary│    │  Gemini API  │
 │ Auth + DB │  │ Image CDN │    │ Text + Image │
 └───────────┘  └───────────┘    └──────────────┘
```

- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
  Deployed on Vercel.
- **Backend**: Next.js API routes (Node.js runtime). Supabase Postgres holds
  all user/project data behind RLS.
- **Auth**: Supabase Auth (email + password). `@supabase/ssr` propagates the
  session cookie across server components and route handlers via
  `src/middleware.ts`.
- **AI**: Google Gemini.
  - `gemini-2.5-flash` produces the **plan** (diagnosis + 3 creative briefs)
    as JSON.
  - `gemini-2.5-flash-image` (Nano Banana) produces each **image**.
- **Image storage**: Cloudinary. We **never** store raw binary in Postgres —
  Gemini returns base64 → we upload to Cloudinary → store the secure URL.

---

## 3. Data flow

### Generate flow (`POST /api/generate`)

1. Client submits `{ projectId, productDescription, prompt, imageDataUrl }`.
2. Server resolves the source image:
   - If a fresh `imageDataUrl` was sent: parse → upload to Cloudinary → store
     the URL on the project.
   - Else if the project already has `image_url`: fetch it back as base64 so
     we can pass it as a reference image to both Gemini calls (preserves
     product fidelity).
3. **Plan call** (`gemini-2.5-flash`, `responseMimeType: application/json`):
   sends prompt + product description + (optional) reference image. Returns
   `{ diagnosis, outputs: [{type, image_prompt, hook, caption, reasoning}] }`.
4. **Image calls** (`gemini-2.5-flash-image`): runs the three image generations
   in parallel. Each prompt is augmented with style + a fidelity instruction,
   and the original product image is passed inline as a reference. Returned
   base64 → uploaded to Cloudinary.
5. Persist:
   - 1 row in `versions` (with `diagnosis`, `prompt`).
   - 1 row in `outputs` per successful image (linked to that version).
6. Return the new `VersionWithOutputs` to the client; it's appended to the
   in-memory list and the new tab is auto-selected.

### Upload flow (`POST /api/upload`)

Used when the user uploads a product image *before* generating, so the Cloudinary
URL is persisted on the project immediately. Server expects `imageDataUrl` (a
`data:image/...;base64,...` URL), splits the prefix, uploads to Cloudinary, and
optionally updates `projects.image_url`.

### Image handling — explicit cases

| Gemini returns       | What we do                                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| `inlineData` (base64) | Decode → upload to Cloudinary → store `secure_url` in `outputs.image_url`.  |
| URL only             | (Not a current Gemini behavior for the image model, but) pass through and store the URL directly. |

We **never** persist raw binary to Postgres. All image fields in the DB are URLs.

---

## 4. Database schema (current)

> Mirrored in [`supabase/schema.sql`](../supabase/schema.sql). Always update both
> this section and that file in lockstep when the schema changes.

### `auth.users` (Supabase-managed)
- `id` (uuid)
- `email`

We do not own/extend the users table. Everything user-scoped joins on `auth.uid()`.

### `public.projects`
| column              | type         | notes                                       |
| ------------------- | ------------ | ------------------------------------------- |
| `id`                | uuid (pk)    | `gen_random_uuid()`                         |
| `user_id`           | uuid (fk)    | → `auth.users(id)`, cascade delete          |
| `name`              | text         | required                                    |
| `product_description` | text       | default `''`                                |
| `image_url`         | text         | nullable; Cloudinary URL of the source product photo |
| `created_at`        | timestamptz  | default `now()`                             |

Index: `(user_id, created_at desc)`.

### `public.versions`
| column        | type        | notes                                                |
| ------------- | ----------- | ---------------------------------------------------- |
| `id`          | uuid (pk)   |                                                      |
| `project_id`  | uuid (fk)   | → `projects(id)`, cascade delete                     |
| `created_at`  | timestamptz | default `now()`                                      |
| `diagnosis`   | jsonb       | `{ whats_wrong: string[], whats_missing: string[], summary: string }` |
| `prompt`      | text        | nullable; the user's extra direction for this run    |

Index: `(project_id, created_at)`.

### `public.outputs`
Custom enum: `output_type = 'studio' | 'lifestyle' | 'poster'`.

| column        | type           | notes                                  |
| ------------- | -------------- | -------------------------------------- |
| `id`          | uuid (pk)      |                                        |
| `version_id`  | uuid (fk)      | → `versions(id)`, cascade delete       |
| `type`        | output_type    | one of studio / lifestyle / poster     |
| `image_url`   | text           | Cloudinary URL                         |
| `hook`        | text           |                                        |
| `caption`     | text           |                                        |
| `reasoning`   | text           | "why this works"                       |

Index: `(version_id)`.

### Row-level security
Every table has RLS enabled with policies that scope all access through the
owning `projects.user_id`. See `supabase/schema.sql` for the exact policies.

---

## 5. API integrations

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by both
  client and server.
- `SUPABASE_SERVICE_ROLE_KEY` — reserved for server-side admin tasks; **never**
  exposed to the browser. Currently unused (RLS + the user's session is enough)
  but available via `createServiceClient()`.

### Gemini (Google AI Studio)
- Single env var: `GEMINI_API_KEY`.
- Models hard-coded in `src/lib/gemini.ts`:
  - Plan: `gemini-2.5-flash`
  - Image: `gemini-2.5-flash-image`
- The plan call uses `responseMimeType: 'application/json'` for reliable parsing.

### Cloudinary
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Folder layout:
  - `pixig/users/<user_id>/uploads/...` — source product photos
  - `pixig/users/<user_id>/projects/<project_id>/outputs/...` — generated images
- We use signed server-side uploads (`cloudinary.uploader.upload`). The browser
  never talks to Cloudinary directly.

---

## 6. Design decisions (and why)

- **Single Generate button (left panel)**: matches the Leonardo.ai workflow.
  Per the spec, regenerate is *not* placed inside individual cards — that would
  invite users to mutate one creative at a time, which breaks the
  "version = full set of three" contract.
- **Versions are immutable**: every Generate appends a new `versions` row with
  a fresh set of `outputs`. Old runs are preserved so users can A/B them.
- **Reference image passed to both calls**: the same product image is sent to
  the planning call (so the diagnosis is grounded) and to each image call (so
  the product stays faithful — same shape, label, color).
- **Parallel image generation**: the three image calls run with `Promise.all`
  to keep wall time reasonable. If a single image fails, we still ship the rest;
  the version is rejected only if *all three* fail.
- **Server-only AI**: Gemini and Cloudinary keys never reach the browser. All
  AI work happens in `/api/generate`, which runs on Node.js (`runtime: 'nodejs'`,
  `maxDuration: 300`).
- **JSON-mode plan**: we ask Gemini for strict JSON via `responseMimeType` and
  do a defensive markdown-fence strip. If parsing fails we throw, surfacing a
  clean error to the UI.
- **No Supabase storage**: we explicitly chose Cloudinary over Supabase Storage
  for the image CDN — better transformations, generous free tier, and we keep
  Supabase scoped to "auth + relational data".
- **Tailwind dark theme + glass UI**: matches the Leonardo aesthetic the spec
  calls out and reads well on Instagram-style preview cards.

---

## 7. Project structure

```
pixig/
├── README.md                        # setup + deployment guide
├── context/
│   └── project-context.md           # ← you are here
├── supabase/
│   └── schema.sql                   # full DB + RLS schema
├── src/
│   ├── middleware.ts                # Supabase session refresh + route guards
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                 # landing page
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── dashboard/page.tsx       # list + create projects
│   │   ├── project/[id]/page.tsx    # workspace
│   │   └── api/
│   │       ├── upload/route.ts      # POST: data URL → Cloudinary
│   │       └── generate/route.ts    # POST: orchestrates AI pipeline
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Logo.tsx
│   │   ├── NewProjectButton.tsx
│   │   ├── ProjectWorkspace.tsx     # client wrapper for /project/[id]
│   │   ├── LeftPanel.tsx            # Leonardo-style inputs + Generate
│   │   ├── VersionTabs.tsx
│   │   ├── DiagnosisPanel.tsx
│   │   └── InstagramCard.tsx        # IG-style preview card
│   └── lib/
│       ├── types.ts                 # shared TS types (Project, Version, Output…)
│       ├── utils.ts                 # cn, formatRelative, truncate
│       ├── gemini.ts                # generatePlan + generateImage
│       ├── cloudinary.ts            # uploadBase64
│       └── supabase/
│           ├── client.ts            # browser client
│           ├── server.ts            # server + service-role clients
│           └── middleware.ts        # session refresh
```

---

## 8. Known limitations

- **Cold start latency**: a full generate runs ~3 image calls + 1 text call =
  often 30-60s wall-clock. The UI shows a shimmer state, but there's no
  streaming progress per-image yet.
- **No regenerate-one-card flow**: by design (see decisions). A future
  improvement could be "duplicate version, swap one output" — but the spec
  explicitly requires regenerate to live in the left panel only.
- **Caption / hashtag length**: governed by the prompt, not enforced. Users on
  IG character limits should still copy-edit.
- **No team / org model**: each project is owned by exactly one user.
- **No download-as-zip / export**: download is per-image (open Cloudinary URL).
- **Free-tier Gemini quotas**: image-generation quotas can be tight on free
  keys; the API route surfaces a 502 with a hint when *all three* images fail.
- **No image editing post-generation**: outputs are write-once per version.
- **Email confirmation flow**: signup either logs the user in immediately (if
  email confirmation is disabled in Supabase) or shows a "check your inbox"
  message. We don't currently host a custom confirmation page.
