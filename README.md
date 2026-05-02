# Pixig.ai

> **Turn boring product images into high-converting Instagram creatives.**
> Upload a product photo + description; Pixig diagnoses your visual gaps and
> ships a studio shot, lifestyle scene, and ad poster — each with its hook,
> caption, and the reasoning behind it. Every generation is versioned.

Built with **Next.js 14**, **Supabase**, **Gemini 2.5** (text + image), and
**Cloudinary**.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
#   → fill in Supabase, Gemini, Cloudinary keys (steps below)

# 3. Run the Supabase schema
#   → Supabase dashboard → SQL editor → paste & run supabase/schema.sql

# 4. Dev
npm run dev
# open http://localhost:3000
```

---

## Project layout

```
src/
├── app/                # Next.js App Router pages + API routes
├── components/         # UI (Leonardo-style left panel, IG cards, etc.)
├── lib/                # supabase, gemini, cloudinary, types, utils
└── middleware.ts       # Supabase session + auth-route guard

context/
└── project-context.md  # ⭐ Architecture, schema, decisions — KEEP UPDATED

supabase/
└── schema.sql          # Tables, enums, indexes, RLS policies
```

> **Important**: `context/project-context.md` is the source of truth for
> architecture and schema. Update it any time the schema, AI pipeline, or
> integration surface changes.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(secret — server only)*
3. Open **Authentication → Providers** and make sure **Email** is enabled.
   For the simplest dev experience, in **Authentication → Sign In / Up →
   Email** set "Confirm email" to **off** during local dev (you can re-enable
   it for production).
4. Open **SQL editor** → paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
5. Verify in **Table editor** that `projects`, `versions`, and `outputs` exist
   and have RLS enabled.

---

## 2. Gemini (Google AI Studio)

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Click **Create API key** → copy it → set `GEMINI_API_KEY`.
3. Pixig uses two models, hard-coded in `src/lib/gemini.ts`:
   - `gemini-2.5-flash` for the plan (diagnosis + creative briefs as JSON).
   - `gemini-2.5-flash-image` for image generation.

Sample text call (for reference — already wired up in `lib/gemini.ts`):

```ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
  config: { responseMimeType: 'application/json' },
});
console.log(result.text);
```

Sample image call:

```ts
const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [{ role: 'user', parts: [
    { text: 'A studio shot of a matte-black water bottle, soft key light…' },
    { inlineData: { mimeType: 'image/jpeg', data: '<base64>' } }, // optional reference
  ]}],
});
// the image comes back as result.candidates[0].content.parts[*].inlineData.data
```

---

## 3. Cloudinary

We never store raw image bytes in Postgres — every image (uploaded + generated)
lives on Cloudinary.

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. Open the **Dashboard** and copy:
   - `Cloud name` → `CLOUDINARY_CLOUD_NAME`
   - `API Key` → `CLOUDINARY_API_KEY`
   - `API Secret` → `CLOUDINARY_API_SECRET`
3. Optionally set `CLOUDINARY_UPLOAD_FOLDER` (default `pixig`).
4. (Optional) In Cloudinary's settings you can pre-create the folder
   `pixig/`, but the SDK will auto-create on first upload.

The upload flow used in the API routes:

```ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ /* keys */ secure: true });

const dataUri = `data:${mimeType};base64,${base64}`;
const res = await cloudinary.uploader.upload(dataUri, {
  folder: 'pixig/users/<user_id>/projects/<project_id>/outputs',
});
// res.secure_url is what we store in DB
```

---

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=pixig

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 5. Local development

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the build
npm run type-check   # tsc --noEmit
npm run lint         # next lint
```

---

## 6. Deploy to Vercel

1. Push the repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Framework preset is auto-detected (Next.js).
4. Add **all** environment variables under **Project Settings → Environment
   Variables** (use `Production`, `Preview`, and `Development` as needed):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_UPLOAD_FOLDER`
   - `NEXT_PUBLIC_APP_URL` *(set to your Vercel domain)*
5. Hit **Deploy**.
6. After the first deploy, in **Supabase → Authentication → URL Configuration**,
   add the Vercel URL to the allowed redirect URLs.

The `/api/generate` route runs on the **Node.js** runtime with
`maxDuration = 300` (5 minutes) — this is required for the Gemini image
calls. On the Vercel free tier the cap is 60 s — upgrade to Pro/Hobby+ if you
need the full window.

---

## 7. How a generation works

1. User opens `/project/[id]` → fills in description / direction / image →
   clicks **Generate**.
2. Browser POSTs to `/api/generate` with `{ projectId, productDescription,
   prompt, imageDataUrl }`.
3. Server:
   - Uploads any new product image to Cloudinary and persists the URL.
   - Calls `gemini-2.5-flash` with the description + reference image →
     receives `{ diagnosis, outputs[] }` as JSON.
   - Calls `gemini-2.5-flash-image` 3× in parallel (one per output type) →
     uploads each image to Cloudinary.
   - Inserts a `versions` row + 3 `outputs` rows.
4. Client receives the new version, prepends it to the version tabs, scrolls
   to the top.

See [`context/project-context.md`](context/project-context.md) for the full
architecture, data flow, schema, and known limitations.

---

## License

Proprietary — all rights reserved.
