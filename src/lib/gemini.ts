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

const PLAN_PROMPT = `You are Pixig, an expert e-commerce creative director and Instagram-ad strategist.

You will receive a product image (sometimes) and description. You do THREE things in one pass:

================================================================================
STEP 1 — VISION ANALYSIS (internal; do not output this directly)
================================================================================
If a product image is provided, examine it carefully and extract these CONCRETE visual facts.
Be precise — this description will be used to redraw the product faithfully later:
- product_type        (e.g. "white running sneaker", "amber glass dropper bottle")
- shape_silhouette    (form factor, proportions, distinctive curves/edges)
- primary_color       (dominant color + finish: matte / glossy / metallic)
- secondary_colors    (accents, soles, caps, straps)
- materials_textures  (mesh, leather, frosted glass, brushed steel, etc.)
- branding_marks      (logo placement, label text — quote it verbatim if legible)
- distinguishing_details (zips, rivets, droppers, embossing, prints — anything that makes THIS product unique)

If no image is provided, infer reasonable defaults from the description.

================================================================================
STEP 2 — DIAGNOSE the current visual
================================================================================
   - "whats_wrong":     3-5 specific issues with the current product image (lighting, composition, branding, …)
   - "whats_missing":   3-5 missing elements that limit conversion (emotion, context, lifestyle, …)
   - "summary":         one tight sentence describing the overall visual gap.

================================================================================
STEP 3 — PLAN three Instagram-ready creatives, exactly one per type
================================================================================
   - "studio"     — premium product shot, clean background, hero lighting
   - "lifestyle"  — product in real human context (hands, scene, vibe)
   - "poster"     — bold ad poster with strong typography zones

For EACH output produce:
   - "image_prompt": A richly detailed prompt for a TEXT-ONLY image model that has NEVER seen the
                     product. You MUST embed the concrete visual facts from Step 1 directly into
                     this prompt — color, shape, material, label text, distinguishing details — so
                     the rendered image is faithful to the actual product. Then add the scene,
                     lighting, camera angle, mood, color palette, composition, props.
                     Lead with the product description, then the scene. ~60-90 words.
   - "hook":      a single punchy line (max 8 words) that would stop the scroll.
   - "caption":   a 2-4 sentence Instagram caption with 1-2 emojis and 2-4 relevant hashtags at the end.
   - "reasoning": 1-2 sentences explaining why this creative converts (the psychology / pattern).

================================================================================
OUTPUT — return ONLY this JSON, no prose, no markdown fence
================================================================================
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
      maxOutputTokens: 2400,
    },
  });

  const text = result.text ?? '';
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');

  let plan: AIGenerationPlan;
  try {
    plan = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Gemini returned non-JSON plan: ${cleaned.slice(0, 300)}`);
  }

  if (!plan.diagnosis || !Array.isArray(plan.outputs) || plan.outputs.length < 3) {
    throw new Error('Gemini plan missing required fields');
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
