import { GoogleGenAI } from '@google/genai';
import type { AIGenerationPlan, OutputType } from './types';

const TEXT_MODEL = 'gemini-2.5-flash';
// Imagen 4 Fast is free-tier eligible (25 RPD) and ~3x cheaper than Nano Banana
// on paid tier. It does NOT accept a reference image — purely text-to-image.
const IMAGE_MODEL = 'imagen-4.0-fast-generate-001';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

const PLAN_PROMPT = `You are Pixig — an expert e-commerce creative director, product photographer,
and Instagram-ad strategist. Your job is to turn a real product into three
scroll-stopping IG creatives backed by a faithful description of the product.

Downstream, a text-only image model (Imagen) will render each creative. It has
NEVER seen the product image. Therefore EVERY image_prompt you write must encode
the product faithfully in words: color, shape, materials, branding, proportions.

You do THREE things in one pass.

╔══════════════════════════════════════════════════════════════════════════════╗
║ STEP 1 — VISION ANALYSIS (internal; do not output this section as JSON)     ║
╚══════════════════════════════════════════════════════════════════════════════╝
If a product image is provided, examine it slowly and extract concrete facts.
If no image is provided, infer reasonable defaults from the description.

A. PRODUCT IDENTITY
   - category            (e.g. "low-top running sneaker", "amber dropper bottle")
   - silhouette          (proportions, key curves/edges, form factor)
   - primary_color       (precise hue + finish: matte / glossy / metallic / brushed)
   - secondary_colors    (accents — soles, caps, straps, trims; describe placement)
   - materials_textures  (mesh, full-grain leather, frosted glass, anodized aluminum…)
   - branding_marks      (logo placement, fonts; QUOTE label text verbatim if legible)
   - signature_details   (zips, rivets, stitching, embossing, perforations, prints)

B. CURRENT-PHOTO CONTEXT
   - background          (color, texture, surface)
   - lighting            (direction, hardness, color temperature, shadows)
   - camera_pov          (angle, distance, lens feel — wide / macro / 3/4)
   - composition_issues  (cropping, negative space, distractions)

╔══════════════════════════════════════════════════════════════════════════════╗
║ STEP 2 — DIAGNOSE the current visual                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
   - "whats_wrong":   3-5 specific, observable flaws (lighting, framing, color
                      cast, branding visibility, distracting backdrop, etc.)
   - "whats_missing": 3-5 conversion-driving elements absent (human emotion,
                      context of use, scale cues, lifestyle proof, etc.)
   - "summary":       one tight sentence on the overall visual gap.

╔══════════════════════════════════════════════════════════════════════════════╗
║ STEP 3 — PLAN three Instagram-ready creatives, one per type                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
For each of {studio, lifestyle, poster}, design a complete creative:

  • studio    — premium hero shot. Clean controlled backdrop, sculpted product
                lighting, deliberate negative space. Built to feel like a
                magazine cover or a luxury PDP image.
  • lifestyle — product in authentic human context (hands, body, environment),
                shallow DOF, candid moment, warm naturalistic light. The
                product is the protagonist of a real scene, not a still life.
  • poster    — bold graphic Instagram ad. Strong typography zone reserved for
                the headline, vivid brand-led palette, high contrast, scroll-
                stopping. Composition treats the product as a graphic element.

For EACH creative produce these fields, in this exact shape:

  "image_prompt"   ~110-150 words. Structure it as:
                   (1) PRODUCT — lead with a faithful product description that
                       embeds the Step-1 facts (color, materials, branding,
                       signature details). The model must be able to redraw the
                       exact product from this sentence alone.
                   (2) SCENE — environment, props, surfaces, supporting subject
                       (hands / model / setting); concrete and specific.
                   (3) CRAFT — camera angle + lens feel, lighting setup
                       (key/fill/rim, color temp, shadow quality), color
                       palette, mood, depth of field, composition rules.
                   (4) NEGATIVES — end with "Avoid: ..." listing 2-3 things the
                       image must NOT contain (text overlays unless poster,
                       distorted product, extra logos, off-brand colors).
                   No markdown, no bullet points inside the prompt — write it
                   as flowing imperative sentences.

  "hook"           A single line, ≤ 8 words. Verb-led, benefit-led, scroll-
                   stopping. No emojis.

  "caption"        2-4 sentences. Voice matching the brand vibe. 1-2 tasteful
                   emojis MAX. End with 2-4 highly-targeted hashtags
                   (no #love / #instagood spam).

  "reasoning"      1-2 sentences. Name the psychological lever (social proof,
                   loss aversion, identity, sensory craving, novelty…) and why
                   it fits this product + audience.

╔══════════════════════════════════════════════════════════════════════════════╗
║ OUTPUT — return ONLY this JSON, no prose, no markdown fence                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
{
  "diagnosis": { "whats_wrong": ["..."], "whats_missing": ["..."], "summary": "..." },
  "outputs": [
    { "type": "studio",    "image_prompt": "...", "hook": "...", "caption": "...", "reasoning": "..." },
    { "type": "lifestyle", "image_prompt": "...", "hook": "...", "caption": "...", "reasoning": "..." },
    { "type": "poster",    "image_prompt": "...", "hook": "...", "caption": "...", "reasoning": "..." }
  ]
}`;

export async function generatePlan(args: {
  productDescription: string;
  userPrompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<AIGenerationPlan> {
  const ai = getClient();

  const userBlock = `PRODUCT DESCRIPTION:\n${args.productDescription}\n\n${
    args.userPrompt ? `EXTRA USER DIRECTION:\n${args.userPrompt}\n` : ''
  }`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: PLAN_PROMPT },
    { text: userBlock },
  ];

  if (args.imageBase64 && args.imageMimeType) {
    parts.push({
      inlineData: {
        mimeType: args.imageMimeType,
        data: args.imageBase64,
      },
    });
  }

  const result = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      // Lower temp so vision-extracted product facts (color, label, materials) stay faithful;
      // creative copy still has enough headroom to vary across runs.
      temperature: 0.7,
      // Generous budget: 3 rich image_prompts (~120 words each) + diagnosis + copy easily
      // exceeds 2k tokens. Without enough headroom the JSON gets truncated mid-string.
      maxOutputTokens: 8192,
      // Disable internal "thinking" — its tokens count against maxOutputTokens, and a
      // structured-JSON task doesn't benefit from chain-of-thought.
      thinkingConfig: { thinkingBudget: 0 },
    } as any,
  });

  const text = result.text ?? '';
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  const finishReason =
    (result as any)?.candidates?.[0]?.finishReason ?? 'unknown';

  let plan: AIGenerationPlan;
  try {
    plan = JSON.parse(cleaned);
  } catch (err) {
    const hint =
      finishReason === 'MAX_TOKENS'
        ? ' (response was truncated — output exceeded token budget)'
        : finishReason && finishReason !== 'STOP'
        ? ` (finishReason=${finishReason})`
        : '';
    throw new Error(
      `Gemini returned non-JSON plan${hint}. Snippet: ${cleaned.slice(0, 240)}…`
    );
  }

  if (!plan.diagnosis || !Array.isArray(plan.outputs) || plan.outputs.length < 3) {
    throw new Error(
      `Gemini plan missing required fields (got ${plan.outputs?.length ?? 0} outputs, finishReason=${finishReason})`
    );
  }

  return plan;
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export async function generateImage(args: {
  prompt: string;
  type: OutputType;
  productImageBase64?: string;
  productImageMimeType?: string;
  hook?: string;
}): Promise<GeneratedImage> {
  const ai = getClient();

  const styleSuffix =
    args.type === 'studio'
      ? ' Studio product photography. Clean seamless background. Soft directional key light, gentle rim, subtle shadow. Square 1:1 composition. Hyper-detailed, commercial quality.'
      : args.type === 'lifestyle'
      ? ' Lifestyle photography. Real human context (hands, scene). Warm natural light, shallow depth of field. Authentic, aspirational mood. Square 1:1 composition.'
      : ` Bold Instagram ad poster. Strong graphic composition with clear typography zone for the headline "${
          args.hook ?? ''
        }". Vivid brand color palette, high contrast, scroll-stopping. Square 1:1 composition.`;

  const fullPrompt = args.prompt + styleSuffix;

  // Imagen 4 — text-to-image only (no reference image input).
  const result: any = await (ai.models as any).generateImages({
    model: IMAGE_MODEL,
    prompt: fullPrompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '1:1',
    },
  });

  const generated = result?.generatedImages?.[0]?.image;
  const bytes = generated?.imageBytes;
  if (bytes) {
    return {
      base64: bytes,
      mimeType: generated.mimeType ?? 'image/png',
    };
  }

  // Surface useful debug info if Imagen returned nothing.
  const reason =
    result?.generatedImages?.[0]?.raiFilteredReason ??
    result?.error?.message ??
    'no image bytes returned';
  throw new Error(`Imagen did not return an image (${reason})`);
}
