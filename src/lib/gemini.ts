import { GoogleGenAI } from '@google/genai';
import type { AIGenerationPlan, OutputType } from './types';

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

const PLAN_PROMPT = `You are Pixig, an expert e-commerce creative director and Instagram-ad strategist.

Given a product image and description, do TWO things:

1. DIAGNOSE the product visual:
   - "whats_wrong": 3-5 specific issues with the current product image (lighting, composition, branding, etc.)
   - "whats_missing": 3-5 missing elements that limit conversion (emotion, context, lifestyle cues, etc.)
   - "summary": one tight sentence describing the overall visual gap.

2. PLAN three Instagram-ready creatives, exactly one per type:
   - "studio"    — premium product shot, clean background, hero lighting
   - "lifestyle" — product in real human context (hands, scene, vibe)
   - "poster"    — bold ad poster with strong typography zones (we will draw text in image)

For EACH output, produce:
   - "image_prompt": a richly detailed prompt for an image-generation model. Describe lighting, camera angle,
                     mood, color palette, composition, props. ALWAYS preserve the actual product faithfully.
   - "hook": a single punchy line (max 8 words) that would stop the scroll.
   - "caption": a 2-4 sentence Instagram caption with 1-2 emojis and 2-4 relevant hashtags at the end.
   - "reasoning": 1-2 sentences explaining why this creative converts (the psychology / pattern).

Return ONLY valid JSON matching this schema, no prose, no markdown fence:
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
      temperature: 0.85,
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

  const fullPrompt =
    args.prompt +
    styleSuffix +
    ' IMPORTANT: keep the actual product faithful to the reference — same shape, color, label, and proportions.';

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: fullPrompt },
  ];

  if (args.productImageBase64 && args.productImageMimeType) {
    parts.push({
      inlineData: {
        mimeType: args.productImageMimeType,
        data: args.productImageBase64,
      },
    });
  }

  const result = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [{ role: 'user', parts }],
  });

  const candidates = result.candidates ?? [];
  for (const candidate of candidates) {
    const partsOut = candidate.content?.parts ?? [];
    for (const part of partsOut) {
      const inline = (part as any).inlineData;
      if (inline?.data) {
        return {
          base64: inline.data,
          mimeType: inline.mimeType ?? 'image/png',
        };
      }
    }
  }

  throw new Error('Gemini did not return an image');
}
